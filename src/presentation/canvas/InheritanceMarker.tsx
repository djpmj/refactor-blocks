/** React Flow の継承辺に使う白抜き UML 三角マーカー。 */
export function InheritanceMarker() {
  return (
    <svg aria-hidden="true" width="0" height="0" className="inheritance-marker-defs">
      <defs>
        <marker
          id="inheritance-arrow"
          markerWidth="16"
          markerHeight="16"
          markerUnits="userSpaceOnUse"
          orient="auto"
          refX="15"
          refY="8"
          viewBox="0 0 16 16"
        >
          <path d="M 1 1 L 15 8 L 1 15 Z" />
        </marker>
        <marker
          id="implements-arrow"
          markerWidth="16"
          markerHeight="16"
          markerUnits="userSpaceOnUse"
          orient="auto"
          refX="15"
          refY="8"
          viewBox="0 0 16 16"
        >
          <path d="M 1 1 L 15 8 L 1 15 Z" />
        </marker>
      </defs>
    </svg>
  );
}
