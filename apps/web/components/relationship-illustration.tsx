import type { ComponentDetail } from '../lib/api';

// Marketing sections use a conceptual graph; the live preview supplies API evidence.
export default function RelationshipIllustration({ components }: { components?: ComponentDetail[] } = {}) {
  if (components) {
    const nodes = components.flatMap((component, groupIndex) => component.samples.map((sample, index) => {
      const centerX = 85 + groupIndex % 3 * 150;
      const centerY = 85 + Math.floor(groupIndex / 3) * 140;
      const angle = index * Math.PI * 2 / component.samples.length;
      return { ...sample, x: centerX + Math.cos(angle) * 48, y: centerY + Math.sin(angle) * 48 };
    }));
    const positions = new Map(nodes.map(node => [node.sample_id, node]));
    return <div className="relationship-illustration"><svg viewBox="0 0 480 310" role="img" aria-label="Saved audit sample relationships from FalkorDB"><g>
      {components.flatMap(component => component.evidence.filter(edge => edge.status === 'confirmed')).map(edge => {
        const a = positions.get(edge.a), b = positions.get(edge.b);
        return a && b ? <g key={edge.pair_id}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#ccd8df" strokeWidth="1.5" /><line className="graph-signal" x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#008261" strokeWidth="2" strokeDasharray="4 150" pathLength="154" /></g> : null;
      })}
      {nodes.map(node => <circle key={node.sample_id} className="ambient-node" cx={node.x} cy={node.y} r="7" fill={node.split === 'test' ? '#ff7416' : node.split === 'validation' ? '#1687ef' : '#008261'} stroke="white" strokeWidth="2"><title>{node.split} · {node.sample_id}</title></circle>)}
    </g></svg></div>;
  }
  const points = Array.from({ length: 34 }, (_, index) => {
    const angle = index * 2.39996;
    const radius = 31 + Math.sqrt(index / 33) * 112;
    return { x: 240 + Math.cos(angle) * radius * 1.48, y: 155 + Math.sin(angle) * radius, test: index % 3 === 0 };
  });
  return <div className="relationship-illustration" aria-hidden="true">
    <svg viewBox="0 0 480 310" focusable="false">
      <g className="graph-orbit">
        {points.map((point, index) => <g key={index}>
          <line x1={point.x} y1={point.y} x2={index % 4 ? 240 : points[Math.max(0, index - 3)].x} y2={index % 4 ? 155 : points[Math.max(0, index - 3)].y} stroke="#dce2e8" strokeWidth="1.3" />
          {index % 4 === 1 && <line className="graph-signal" style={{ animationDelay: index * -.3 + 's' }} x1={point.x} y1={point.y} x2="240" y2="155" stroke={point.test ? '#ff7416' : '#008261'} strokeWidth="2" strokeDasharray="4 150" pathLength="154" />}
          <circle className="ambient-node" style={{ animationDelay: index * -.19 + 's' }} cx={point.x} cy={point.y} r="5.5" fill={point.test ? '#ff7416' : '#008261'} stroke="white" strokeWidth="1.5" />
        </g>)}
        <circle className="graph-center-halo" cx="240" cy="155" r="20" fill="none" stroke="#008261" strokeWidth="1" />
        <circle cx="240" cy="155" r="12" fill="white" stroke="#008261" strokeWidth="2" /><circle cx="240" cy="155" r="5" fill="#ff7416" />
      </g>
    </svg>
  </div>;
}
