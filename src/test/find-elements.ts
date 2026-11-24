import { isValidElement, type ReactElement, type ReactNode } from "react";

/**
 * Collect every element of `type` in an unrendered element tree. Only walks
 * `children` props, so it sees what a server layout returns without running
 * the components inside it.
 */
export function findElements(node: ReactNode, type: unknown): ReactElement[] {
  if (Array.isArray(node)) return node.flatMap((child) => findElements(child, type));
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  const own = node.type === type ? [node] : [];
  return [...own, ...findElements(node.props.children, type)];
}
