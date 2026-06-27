interface SectionHeadingProps {
  title: string
  description?: string
  onDark?: boolean
  prominent?: boolean
}

export function SectionHeading({
  title,
  description,
  onDark = false,
  prominent = false,
}: SectionHeadingProps) {
  return (
    <div className="section-heading">
      <h2
        className={`section-heading__title ${
          prominent ? 'section-heading__title--prominent' : ''
        } ${onDark ? 'text-white' : 'text-foreground'}`}
      >
        {title}
      </h2>
      {description && (
        <p
          className={`section-heading__description ${
            onDark ? 'text-white/55' : 'text-muted-foreground'
          }`}
        >
          {description}
        </p>
      )}
    </div>
  )
}
