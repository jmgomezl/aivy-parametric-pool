/** The approved submission mark, unchanged and shared across the website. */
export function QuorumMark({ className = '' }: { className?: string }) {
  return <img
    className={`quorum-mark ${className}`}
    src="/brand/quorum-mark-0ceecc.png"
    width="40"
    height="40"
    alt=""
    aria-hidden="true"
    draggable={false}
  />;
}
