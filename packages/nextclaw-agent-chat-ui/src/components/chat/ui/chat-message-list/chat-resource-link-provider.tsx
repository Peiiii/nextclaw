import { createContext, useContext, type ReactNode } from "react";

const ResourceIconContext = createContext<((href: string) => ReactNode) | null>(
  null,
);

/** Host supplies resource identity without teaching the generic Markdown renderer product routes. */
export function ChatResourceLinkProvider({
  renderIcon,
  children,
}: {
  renderIcon: (href: string) => ReactNode;
  children: ReactNode;
}) {
  return (
    <ResourceIconContext.Provider value={renderIcon}>
      {children}
    </ResourceIconContext.Provider>
  );
}

export function useChatResourceLinkIcon(href: string | null): ReactNode {
  const renderIcon = useContext(ResourceIconContext);
  return href && renderIcon ? renderIcon(href) : null;
}
