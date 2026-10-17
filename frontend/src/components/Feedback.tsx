export function LoadingMessage({ children = 'Checking your session…' }: { children?: string }) {
  return <main aria-live="polite" className="feedback"><p>{children}</p></main>;
}

export function ErrorMessage({ children }: { children: string }) {
  return <main className="feedback"><h1>We could not load this page.</h1><p role="alert">{children}</p></main>;
}
