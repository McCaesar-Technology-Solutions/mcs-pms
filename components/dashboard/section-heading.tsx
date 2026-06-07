interface SectionHeadingProps {
  title: string
  description?: string
}

export function SectionHeading({ title, description }: SectionHeadingProps) {
  return (
    <div className="mb-1">
      <h2 className="section-heading text-lg font-semibold text-foreground">{title}</h2>
      {description && (
        <p className="ml-[calc(0.625rem+4px)] text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  )
}
