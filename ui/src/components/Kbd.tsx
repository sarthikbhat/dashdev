interface Props {
  children: React.ReactNode;
}

export default function Kbd({ children }: Props) {
  return <span className="kbd">{children}</span>;
}
