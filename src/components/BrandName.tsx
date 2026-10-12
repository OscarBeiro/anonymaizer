import type { ReactNode } from 'react';

export const BrandName = () => <strong className="brand-name">AnonymAIzer</strong>;

export const BrandText = ({ text }: { text: string }): ReactNode =>
  text.split(/(AnonymAIzer)/g).map((part, index) =>
    part === 'AnonymAIzer' ? <BrandName key={index} /> : part,
  );
