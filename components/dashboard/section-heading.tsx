interface SectionHeadingProps {
  title: string
  description?: string
  onDark?: boolean
}

export function SectionHeading({ title, description, onDark = false }: SectionHeadingProps) {
  return (
    <div className="mb-1">
      <h2
        className={`section-heading text-xl font-semibold tracking-tight ${
          onDark ? 'section-heading--on-dark text-white' : 'text-foreground'
        }`}
      >
        {title}
      </h2>
      {description && (
        <p
          className={`ml-[calc(0.625rem+4px)] max-w-2xl text-sm leading-relaxed ${
            onDark ? 'text-white/60' : 'text-muted-foreground'
          }`}
        >
          {description}
        </p>
      )}
    </div>
  )
}
