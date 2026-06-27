interface SectionHeadingProps {
  title: string
  description?: string
  onDark?: boolean
}

export function SectionHeading({ title, description, onDark = false }: SectionHeadingProps) {
  return (
    <div>
      <h2
        className={`text-[0.9375rem] font-semibold tracking-tight ${
          onDark ? 'text-white' : 'text-foreground'
        }`}
      >
        {title}
      </h2>
      {description && (
        <p
          className={`mt-0.5 text-sm ${
            onDark ? 'text-white/50' : 'text-muted-foreground'
          }`}
        >
          {description}
        </p>
      )}
    </div>
  )
}
