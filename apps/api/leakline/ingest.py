import hashlib
import json
import random
import re
import math
from urllib.parse import urlparse
from datasets import get_dataset_config_names, load_dataset_builder, load_dataset
from huggingface_hub import HfApi
from .models import InspectRequest, AuditRequest, Source, Sample
from .matching import normalize


def digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def label_value(row,column):
    if column is None or row[column] is None:
        return None
    value=row[column]
    if isinstance(value,list) and all(type(v) is int and v>=0 for v in value):
        return json.dumps(sorted(set(value)))
    if isinstance(value,(str,int,bool)) or isinstance(value,float) and math.isfinite(value):
        return str(value)
    raise ValueError("unsupported_column: labels must be scalar classes or lists of nonnegative class IDs")


def dataset_id(value: str) -> str:
    value = value.strip()
    if "://" in value:
        u = urlparse(value)
        if u.scheme != "https" or u.netloc != "huggingface.co" or u.query or u.fragment:
            raise ValueError("invalid_dataset_url")
        if not u.path.startswith("/datasets/"):
            raise ValueError("invalid_dataset_url")
        value = u.path[len("/datasets/"):].rstrip("/")
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]*/[A-Za-z0-9][A-Za-z0-9_.-]*", value):
        raise ValueError("invalid_dataset_url")
    return value


def inspect(req: InspectRequest) -> Source:
    name = dataset_id(req.dataset)
    info = HfApi(token=False).dataset_info(name, revision=req.revision, timeout=30)
    if info.private or info.gated:
        raise ValueError("forbidden_dataset")
    sha = info.sha
    configs = get_dataset_config_names(name, revision=sha, token=False, trust_remote_code=False)
    config = req.config or ("default" if "default" in configs else configs[0] if len(configs) == 1 else None)
    if config not in configs:
        raise ValueError(f"Select config from {configs}")
    builder = load_dataset_builder(name, name=config, revision=sha, token=False, trust_remote_code=False)
    splits = {k: v.num_examples for k, v in (builder.info.splits or {}).items()}
    if not splits or any(v <= 0 for v in splits.values()):
        raise ValueError("no_supported_split_metadata")
    card = info.card_data.to_dict() if info.card_data else {}
    license_value = card.get("license", "unknown")
    license_text = ", ".join(license_value) if isinstance(license_value, list) else str(license_value)
    return Source(dataset_id=name, revision_sha=sha, config=config, configs=configs,
                  splits=splits, columns={k: str(v) for k, v in builder.info.features.items()},
                  license=license_text)


def ingest(req: AuditRequest, source: Source) -> list[Sample]:
    selected = list(dict.fromkeys(req.train_splits + req.evaluation_splits))
    if not set(selected) <= source.splits.keys():
        raise ValueError("no_supported_splits")
    if sum(min(source.splits[s], req.limit_per_split) for s in selected) > 5000:
        raise ValueError("audit_budget_exceeded: maximum 5000 total rows")
    if req.text_column not in source.columns or (req.label_column and req.label_column not in source.columns):
        raise ValueError("unsupported_column")
    samples = []
    total_characters = 0
    # Seeded indices preserve original row identity. Streaming bounds memory, not download bytes.
    for split in selected:
        total = source.splits[split]
        indices = sorted(random.Random(req.seed).sample(range(total), min(total, req.limit_per_split)))
        wanted = set(indices)
        ds = load_dataset(source.dataset_id, name=source.config, revision=source.revision_sha,
                          split=split, streaming=True, token=False, trust_remote_code=False)
        found = 0
        for i, row in enumerate(ds):
            if i in wanted:
                text = row.get(req.text_column)
                if not isinstance(text, str) or not text.strip():
                    raise ValueError("unsupported_column: nonempty strings required")
                if len(text) > 100000:
                    raise ValueError("audit_budget_exceeded: maximum 100000 characters per row")
                total_characters += len(text)
                if total_characters > 10000000:
                    raise ValueError("audit_budget_exceeded: maximum 10000000 analyzed characters")
                identity = json.dumps([source.dataset_id, source.revision_sha, source.config, split, i])
                samples.append(Sample(sample_id=digest(identity), split=split, row_index=i, text=text,
                                      label=label_value(row,req.label_column),
                                      raw_hash=digest(text), text_hash=digest(normalize(text))))
                found += 1
            if i >= indices[-1]:
                break
        if found != len(indices):
            raise ValueError("partial_ingest: rows differ from pinned split metadata")
    return samples
