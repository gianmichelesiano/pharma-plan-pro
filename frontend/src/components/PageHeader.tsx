type PageHeaderProps = {
  title: string;
  description: string;
};

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header-copy">
        <h2>{title}</h2>
        <p className="page-description mobile-only">{description}</p>
      </div>
      <p className="page-description desktop-only">{description}</p>
    </header>
  );
}
