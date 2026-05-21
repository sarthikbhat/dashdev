interface Props {
  ch: string;
  color?: string;
}

export default function Glyph({ ch, color = '#60a5fa' }: Props) {
  return (
    <div
      style={{
        width: 16,
        height: 16,
        borderRadius: 3,
        background: `${color}22`,
        color,
        border: `1px solid ${color}33`,
        fontWeight: 600,
        fontSize: 11,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        lineHeight: 1,
        userSelect: 'none',
      }}
    >
      {ch}
    </div>
  );
}
