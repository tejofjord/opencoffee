interface LoadingProps {
  message?: string;
}

export function Loading({ message = "Loading..." }: LoadingProps) {
  return (
    <div className="loading">
      <div className="loading-spinner" />
      <span>{message}</span>
    </div>
  );
}
