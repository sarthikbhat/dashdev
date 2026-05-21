interface Props {
  blue?: boolean;
}

export default function Spinner({ blue }: Props) {
  return <div className={`spinner${blue ? ' blue' : ''}`} />;
}
