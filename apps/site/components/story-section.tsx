import { motion } from 'framer-motion';

type StorySectionProps = {
  step: string;
  title: string;
  body: string;
  active: boolean;
};

export function StorySection({ step, title, body, active }: StorySectionProps) {
  return (
    <motion.article
      className={`story-copy-card${active ? ' story-copy-card--active' : ''}`}
      initial={false}
      animate={{
        opacity: active ? 1 : 0.52,
        x: active ? 0 : -20,
        scale: active ? 1 : 0.98,
      }}
      transition={{ type: 'spring', stiffness: 160, damping: 22, mass: 0.9 }}
    >
      <div className="story-copy-card__step">{step}</div>
      <h3>{title}</h3>
      <p>{body}</p>
    </motion.article>
  );
}
