import React from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight } from 'lucide-react';

interface HighlightCardProps {
  category: string;
  title: string;
  description: string;
  image: string;
  gradient: string;
  className?: string;
}

export function HighlightCard({ category, title, description, image, gradient, className }: HighlightCardProps) {
  return (
    <div className={cn(
      'group relative overflow-hidden rounded-xl bg-white border border-gray-200 flex h-[180px] transition-all duration-base hover:shadow-card-hover hover:border-gray-300 cursor-pointer',
      className
    )}>
      <div className="flex-1 p-6 flex flex-col">
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">{category}</span>
        <h3 className="text-lg font-semibold text-gray-900 leading-tight mb-2 group-hover:text-primary transition-colors duration-fast">{title}</h3>
        <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed max-w-[200px]">{description}</p>

        <div className="mt-auto flex items-center gap-1 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-fast">
          Learn more <ArrowRight className="h-3 w-3" />
        </div>
      </div>

      <div className={cn('w-[160px] relative overflow-hidden', gradient)}>
        <img
          src={image}
          alt={title}
          className="w-full h-full object-cover mix-blend-multiply opacity-90 group-hover:scale-110 transition-transform duration-slow"
        />
        <div className="absolute inset-0 bg-gradient-to-l from-transparent to-white/10" />
      </div>
    </div>
  );
}
