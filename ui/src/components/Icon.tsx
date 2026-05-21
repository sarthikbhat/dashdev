interface Props {
  name: string;
  size?: number;
  fill?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export default function Icon({ name, size, fill, className, style }: Props) {
  const classes = ['icon', fill ? 'fill' : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <span
      className={classes}
      style={size !== undefined ? { fontSize: size, ...style } : style}
    >
      {name}
    </span>
  );
}
