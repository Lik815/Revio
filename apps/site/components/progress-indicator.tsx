type ProgressIndicatorProps = {
  count: number;
  currentIndex: number;
};

export function ProgressIndicator({ count, currentIndex }: ProgressIndicatorProps) {
  return (
    <div className="story-progress" aria-label="Scroll Fortschritt">
      {Array.from({ length: count }).map((_, index) => (
        <span
          key={index}
          className={`story-progress__dot${index === currentIndex ? ' story-progress__dot--active' : ''}`}
        />
      ))}
    </div>
  );
}
