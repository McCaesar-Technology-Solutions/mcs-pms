interface SectionHeadingProps {
  title: string
  description?: string
  onDark?: boolean
}

export function SectionHeading({ title, description, onDark = false }: SectionHeadingProps) {
  return (
    <div className="mb-4">
      <h2
        className={`text-lg font-semibold tracking-tight ${
          onDark ? 'text-white' : 'text-foreground'
        }`}
      >
        {title}
      </h2>
      {description && (
        <p
          className={`mt-1 max-w-2xl text-sm leading-relaxed ${
            onDark ? 'text-white/55' : 'text-muted-foreground'
          }`}
        >
          {description}
        </p>
      )}
    </div>
  )
}
