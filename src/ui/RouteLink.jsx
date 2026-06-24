import { useRouteLink } from '../useHashRoute.js';

export default function RouteLink({
  target,
  className,
  children,
  onClick: callerOnClick,
  ...rest
}) {
  const { href, onClick: hookOnClick } = useRouteLink(target);

  const handleClick = (e) => {
    if (callerOnClick) callerOnClick(e);
    hookOnClick(e);
  };

  return (
    <a className={className} href={href} {...rest} onClick={handleClick}>
      {children}
    </a>
  );
}
