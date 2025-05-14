// Quicke/apps/web/components/SkeletonLoader.js
import React from 'react';

/**
 * Represents a single dark segment (glob) within a skeleton line.
 * It will now be thicker and fully rounded.
 */
const Glob = ({ widthClass = 'w-full', shimmerGradient, animationClass }) => {
  return (
    // Each glob is now relative and clips its overflow for the shimmer.
    // bg-black for the globs.
    // rounded-full for the capsule shape.
    <div className={`h-full ${widthClass} bg-neutral-900 rounded-full relative overflow-hidden`}>
      {/* Shimmer effect applied inside each glob */}
      <div className={`absolute inset-0 ${shimmerGradient} ${animationClass}`}></div>
    </div>
  );
};

/**
 * Represents a single visual line in the skeleton loader, composed of one or more globs.
 * This will also be thicker and its container fully rounded if it doesn't span the full width.
 */
const SkeletonLine = ({ children }) => {
  return (
    // h-6 makes the lines thicker (24px). Adjust if needed (e.g., h-7 for 28px).
    // rounded-full will apply to the container if the line is not w-full, making its ends round.
    <div className="h-6 w-full rounded-full"> {/* No background here, gaps show parent bg */}
      {/* Flex container for the globs, with a gap to create visual separation. */}
      {/* Increased gap to 'gap-2' (8px) for better separation with thicker lines. */}
      <div className="flex h-full items-center gap-2">
        {children}
      </div>
    </div>
  );
};

const SkeletonLoader = () => {
  // Lightish grey shimmer for better contrast against black globs.
  const lightGreyShimmerGradient = "bg-[linear-gradient(to_right,transparent_0%,rgba(156,163,175,0.08)_20%,rgba(156,163,175,0.15)_40%,rgba(156,163,175,0.2)_50%,rgba(156,163,175,0.15)_60%,rgba(156,163,175,0.08)_80%,transparent_100%)]";
  const animationClass = "animate-[shimmer_2.0s_infinite]";

  return (
    // Increased outer gap to 'gap-4' (16px) for more breathing room between thicker lines.
    <div className="flex flex-col gap-4"> 
      
      {/* Line 1: Overall 75% width, two globs */}
      <div className="w-3/4">
        <SkeletonLine>
          <Glob widthClass="w-2/3" shimmerGradient={lightGreyShimmerGradient} animationClass={animationClass} />
          <Glob widthClass="w-1/3" shimmerGradient={lightGreyShimmerGradient} animationClass={animationClass} />
        </SkeletonLine>
      </div>

      {/* Line 2: Full width, three globs */}
      <div className="w-full">
        <SkeletonLine>
          <Glob widthClass="w-1/2" shimmerGradient={lightGreyShimmerGradient} animationClass={animationClass} />
          <Glob widthClass="w-1/4" shimmerGradient={lightGreyShimmerGradient} animationClass={animationClass} />
          <Glob widthClass="w-1/4" shimmerGradient={lightGreyShimmerGradient} animationClass={animationClass} />
        </SkeletonLine>
      </div>

      {/* Line 3: Overall 5/6 width, two globs */}
      <div className="w-5/6">
        <SkeletonLine>
          <Glob widthClass="w-3/5" shimmerGradient={lightGreyShimmerGradient} animationClass={animationClass} />
          <Glob widthClass="w-2/5" shimmerGradient={lightGreyShimmerGradient} animationClass={animationClass} />
        </SkeletonLine>
      </div>
      
      {/* Line 4: Full width, two large globs */}
       <div className="w-full">
        <SkeletonLine>
          <Glob widthClass="w-3/5" shimmerGradient={lightGreyShimmerGradient} animationClass={animationClass} />
          <Glob widthClass="w-2/5" shimmerGradient={lightGreyShimmerGradient} animationClass={animationClass} />
        </SkeletonLine>
      </div>

      {/* Line 5: Overall 1/2 width, one glob */}
      <div className="w-1/2">
        <SkeletonLine>
          <Glob widthClass="w-full" shimmerGradient={lightGreyShimmerGradient} animationClass={animationClass} />
        </SkeletonLine>
      </div>
    </div>
  );
};

export default SkeletonLoader;