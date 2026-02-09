interface Props {
  message: string;
}

export function ErrorBanner({ message }: Props) {
  return (
    <div class="hcw-error">
      <span>{message}</span>
    </div>
  );
}
