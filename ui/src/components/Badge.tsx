interface Props {
  kind?: 'success' | 'fail' | 'run' | 'pending' | 'info';
  children: React.ReactNode;
  dot?: boolean;
}

export default function Badge({ kind, children, dot }: Props) {
  const classes = ['badge', kind ?? ''].filter(Boolean).join(' ');
  return (
    <span className={classes}>
      {dot && <span className="dot" />}
      {children}
    </span>
  );
}
