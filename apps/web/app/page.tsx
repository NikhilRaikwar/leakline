import Link from 'next/link';
import MarketingNav from '../components/marketing-nav';
import ProductPreview from '../components/product-preview';
import MotionProvider from '../components/motion-provider';
import { Arrow, Check, SectionHeading, Wordmark } from '../components/ui';

const steps = [
  { number: '01', title: 'Import a real dataset', text: 'Pin a public Hugging Face revision, inspect its actual splits, and choose the rows to analyze.', visual: 'source' },
  { number: '02', title: 'Find connected samples', text: 'Compare text deterministically, verify evidence, and ask FalkorDB which samples belong to the same group.', visual: 'graph' },
  { number: '03', title: 'Review and verify a repair', text: 'Preview a deterministic manifest, check it independently against the graph, and approve it only when you are ready.', visual: 'verify' },
];

const featureItems = [
  { title: 'Find hidden overlap', text: 'Surface exact duplicates and verified near-duplicate candidates across the splits you actually analyzed.', mark: '01', detail: 'Confirmed evidence stays distinct from candidates.' },
  { title: 'Trace every connection', text: 'Follow evidence-backed relationships through a connected component, including multi-hop paths.', mark: '02', detail: 'Component membership comes from FalkorDB WCC.' },
  { title: 'Repair with confidence', text: 'Keep official test rows in place or create a clearly labeled grouped alternative experiment.', mark: '03', detail: 'A proposed manifest never changes the source.' },
  { title: 'Verify what changed', text: 'Re-query the graph, inspect assignments and distributions, then approve a checksum-bound plan.', mark: '04', detail: 'The AI agent cannot approve repairs.' },
];

const questions = [
  ['What is dataset leakage?', 'Leakage occurs when information shared between training and evaluation data can make a benchmark less independent. Leakline checks for accepted text-duplicate relationships within the rows it analyzes; it does not detect every possible form of leakage.'],
  ['Does Leakline modify the original dataset?', 'No. It reads the pinned source, stores an audit copy in the local graph database, and creates a separate proposed assignment manifest. Exports are not an overwritten Hugging Face dataset.'],
  ['Can Leakline prove all leakage is gone?', 'No. Results cover the inspected rows, detector thresholds, accepted relationships, and selected policy boundary. Sampling, missed candidates, semantic overlap, and uninspected rows remain outside that claim.'],
  ['Why does Leakline use FalkorDB?', 'Accepted duplicate edges form a graph. FalkorDB’s WCC algorithm identifies complete connected groups, including multi-hop relationships, which drive repair scope and independent validation.'],
  ['What datasets are currently supported?', 'Public Hugging Face datasets with a supported text column and optional label column. Leakline resolves a pinned revision and uses the source’s real split metadata. Private or gated datasets are not supported.'],
  ['Can the AI agent approve a repair?', 'No. The agent can inspect graph evidence and propose or validate a deterministic plan. Approval is a separate explicit user action, and downloads stay gated by backend validation and approval.'],
];

function MiniSplitDiagram() {
  return <div className="mini-split-diagram" aria-label="Conceptual illustration of the same sample appearing across two splits">
    <div className="mini-split-column"><span className="split-tag split-train">Training</span><i /><i /><b /></div>
    <span className="mini-connector" aria-hidden="true" />
    <div className="mini-split-column mini-test"><span className="split-tag split-test">Test</span><i /><b /><i /></div>
  </div>;
}

function MiniComponentDiagram() {
  return <div className="mini-component-diagram" aria-label="Conceptual multi-hop relationship illustration">
    <span className="mini-edge edge-one" /><span className="mini-edge edge-two" />
    <i className="node node-a" /><i className="node node-b" /><i className="node node-c" />
    <span className="mini-node-label">accepted edges</span>
  </div>;
}

export default function Home() {
  return <MotionProvider><main className="marketing-page">
    <MarketingNav />
    <section className="hero-section page-shell" aria-labelledby="hero-title">
      <p className="eyebrow">Dataset integrity for AI engineers</p>
      <h1 id="hero-title" className="editorial-heading">Your model’s evaluation<br className="hero-break" /> deserves a second look.</h1>
      <p className="hero-copy">Detect hidden train/test overlap, trace connected samples, and create a leakage-audited evaluation split.</p>
      <div className="hero-actions"><Link className="btn-primary" href="/app/new">Audit a dataset <Arrow /></Link><a className="btn-secondary" href="#how-it-works">See how it works <Arrow /></a></div>
      <div className="trust-notes"><span><Check /> Public datasets</span><span><Check /> Evidence-backed</span><span><Check /> Reproducible</span></div>
    </section>

    <section id="product" data-reveal className="product-showcase page-shell" aria-label="Live Leakline product preview">
      <ProductPreview />
    </section>

    <section data-reveal className="section-space problem-section" id="problem">
      <div className="page-shell">
        <SectionHeading align="center" title="High accuracy doesn’t always mean reliable evaluation." description="A benchmark can look strong when related examples cross the boundary. Leakline makes the checked evidence inspectable." />
        <div className="problem-grid">
          <article className="problem-item"><MiniSplitDiagram /><h3>Hidden overlap across splits</h3><p>Near-duplicates can land in both training and evaluation data, weakening the independence of a score.</p></article>
          <article className="problem-item"><div className="score-illustration" aria-label="Conceptual comparison, not measured benchmark results"><span>Evaluation signal</span><div className="score-bars"><i /><i /></div><div className="score-axis"><span>Shared examples</span><span>Separated groups</span></div><small>Conceptual comparison · no benchmark values shown</small></div><h3>Misleading benchmark interpretation</h3><p>Even a small set of shared examples can warrant review before results are treated as independent.</p></article>
          <article className="problem-item"><MiniComponentDiagram /><h3>Hard-to-trace relationships</h3><p>Duplicate evidence can form connected groups across more than one pair. The path matters.</p></article>
        </div>
      </div>
    </section>

    <section data-reveal id="how-it-works" className="section-space process-section">
      <div className="page-shell">
        <SectionHeading align="center" title="From dataset to verified split." description="A reviewable workflow, from the source revision to an independently checked proposal." />
        <div className="steps-grid">{steps.map(step => <article key={step.number} className="step-item"><div className="step-visual"><span className="step-number">{step.number}</span>{step.visual === 'source' ? <div className="source-visual"><span className="source-line long" /><span className="source-line" /><span className="source-line short" /><div className="source-splits"><b>train</b><b>validation</b><b>test</b></div></div> : step.visual === 'graph' ? <MiniComponentDiagram /> : <div className="verify-visual"><span>Proposed</span><i>→</i><span>Verified</span><small>Scope remains explicit</small></div>}</div><h3>{step.title}</h3><p>{step.text}</p></article>)}</div>
      </div>
    </section>

    <section data-reveal id="features" className="section-space feature-section">
      <div className="page-shell">
        <SectionHeading title="Built for engineers who need evidence." description="Tools that keep decisions tied to source rows, accepted relationships, and a repeatable graph query." />
        <div className="feature-grid">{featureItems.map(item => <article key={item.mark} className="feature-item"><span className="feature-index mono">{item.mark}</span><h3>{item.title}</h3><p>{item.text}</p><div className="feature-detail"><Check />{item.detail}</div></article>)}</div>
      </div>
    </section>

    <section data-reveal id="evidence" className="section-space evidence-section">
      <div className="page-shell">
        <SectionHeading align="center" title="Understand every flagged relationship." description="Open a real component to inspect sample IDs, split membership, accepted pair evidence, and a graph-returned path." />
        <div className="evidence-layout">
          <div className="evidence-graph-card surface"><div className="panel-topline"><strong>Connected component</strong><span className="status-pill"><span className="status-dot ok" />Confirmed relationship</span></div><MiniComponentDiagram /><p>Each displayed edge is backed by an accepted duplicate relationship. Candidate-only similarities do not join WCC components.</p></div>
          <div className="evidence-copy"><p className="eyebrow">Inspectable by design</p><h3 className="editorial-heading">A finding comes with its trail.</h3><p>Read the source splits, evidence method, verified score and threshold, component ID, and actual bounded path returned by FalkorDB.</p><ul className="evidence-list"><li><Check /> Stable sample IDs and row indices</li><li><Check /> Confirmed pair evidence kept separate from candidates</li><li><Check /> Source revision and analyzed coverage</li><li><Check /> Multi-hop connected-component membership</li></ul><Link href="/app" className="text-link">Open the workspace <Arrow /></Link></div>
        </div>
      </div>
    </section>

    <section data-reveal className="section-space proof-section">
      <div className="page-shell">
        <SectionHeading align="center" title="Proof, not just a warning." description="A proposed repair is checked against the graph again. Its scope and remaining overlaps stay visible." />
        <div className="proof-comparison">
          <article className="proof-side proof-before"><div className="proof-label"><span className="proof-marker" />Original audit scope</div><p>Accepted components can span the configured training and evaluation splits.</p><div className="proof-row"><span>Source samples</span><strong>Unchanged</strong></div><div className="proof-row"><span>Graph evidence</span><strong>Retained</strong></div><div className="proof-note warn-note">A partial audit cannot establish full-dataset cleanliness.</div></article>
          <div className="proof-arrow" aria-hidden="true">→</div>
          <article className="proof-side proof-after"><div className="proof-label"><span className="proof-marker" />Reviewed alternative manifest</div><p>Policy A can quarantine non-test rows that connect to protected test examples.</p><div className="proof-row"><span>Protected test rows</span><strong>Assignments preserved</strong></div><div className="proof-row"><span>Other split overlaps</span><strong>Reported separately</strong></div><div className="proof-note">Train/validation overlap is not automatically resolved by Policy A.</div></article>
        </div>
        <p className="proof-caption">These are policy behaviors, not a promise that every audit produces a repair. The workspace loads actual plan and validation responses.</p>
      </div>
    </section>

    <section data-reveal id="falkordb" className="section-space graph-tech-section">
      <div className="page-shell graph-tech-layout">
        <div><p className="eyebrow">Graph-native analysis</p><h2 className="editorial-heading">Powered by FalkorDB.</h2><p>Leakline stores samples, source splits, pair evidence, and accepted duplicate relationships in FalkorDB. WCC identifies complete groups; the deterministic repair planner and independent validator use those graph-backed groups.</p><p>The bounded AI agent investigates through real, read-only MCP tools. It can recommend an action, but it cannot approve a repair or write arbitrary Cypher.</p><a href="https://github.com/NikhilRaikwar/leakline/blob/main/docs/falkordb-architecture.md" target="_blank" rel="noreferrer" className="text-link">Read the graph architecture <Arrow /></a></div>
        <div className="cypher-panel"><div className="cypher-heading"><span>Connected components</span><span className="status-pill">FalkorDB WCC</span></div><pre><code>{"CALL algo.wcc({\n  nodeLabels: ['Sample'],\n  relationshipTypes: ['CONFIRMED_DUPLICATE_OF']\n})\nYIELD node, componentId\nRETURN node.sample_id, node.split, componentId"}</code></pre><p>Candidate-only edges are excluded from confirmed connected-component analysis.</p></div>
      </div>
    </section>

    <section data-reveal className="section-space faq-section" id="faq">
      <div className="page-shell"><SectionHeading align="center" title="Frequently asked questions." /><div className="faq-list">{questions.map(([question, answer]) => <details key={question} className="faq-item"><summary>{question}<span aria-hidden="true" /></summary><p>{answer}</p></details>)}</div></div>
    </section>

    <section data-reveal className="final-cta"><div className="page-shell"><p className="eyebrow">Start with the evidence</p><h2 className="editorial-heading">Know what’s connected before you trust your score.</h2><p>Audit a public dataset revision and inspect the rows and relationships behind each finding.</p><Link className="btn-primary" href="/app/new">Audit your dataset <Arrow /></Link></div></section>

    <footer className="marketing-footer"><div className="page-shell footer-inner"><div><Wordmark /><p>Dataset integrity for more trustworthy AI evaluations.</p></div><nav aria-label="Footer"><a href="#product">Product</a><a href="https://github.com/NikhilRaikwar/leakline/tree/main/docs" target="_blank" rel="noreferrer">Docs</a><a href="https://github.com/NikhilRaikwar/leakline" target="_blank" rel="noreferrer">GitHub</a><a href="https://github.com/NikhilRaikwar/leakline/blob/main/docs/algorithms.md" target="_blank" rel="noreferrer">Methodology</a><a href="https://github.com/NikhilRaikwar/leakline/blob/main/docs/submission-readiness.md" target="_blank" rel="noreferrer">Privacy & scope</a></nav><span className="footer-note">Local-first analysis · Original datasets remain unchanged</span></div></footer>
  </main></MotionProvider>;
}
