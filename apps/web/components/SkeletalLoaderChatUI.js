// Quicke/apps/web/components/SkeletonLoaderChatUI.js
import React from 'react';

// Define shimmer constants (these were from the original SkeletonLoader.js)
const lightGreyShimmerGradient = "bg-[linear-gradient(to_right,transparent_0%,rgba(156,163,175,0.08)_20%,rgba(156,163,175,0.15)_40%,rgba(156,163,175,0.2)_50%,rgba(156,163,175,0.15)_60%,rgba(156,163,175,0.08)_80%,transparent_100%)]";
const shimmerAnimationClass = "animate-[shimmer_2.0s_infinite]";

const ShimmerBlock = ({ className = "" }) => {
  return (
    <div className={`${className} relative overflow-hidden bg-neutral-700`}> {/* Base color for the block */}
      <div className={`absolute inset-0 ${lightGreyShimmerGradient} ${shimmerAnimationClass}`}></div>
    </div>
  );
};

const SkeletonMessage = ({ isUser = false }) => {
  // Base background for the message bubble container, can be transparent if ShimmerBlocks have their own bg
  const bubbleBg = "bg-neutral-800"; // Or bg-transparent if ShimmerBlock's bg-neutral-700 is enough

  if (isUser) {
    // User message (right-aligned)
    return (
      <div className="flex justify-end mb-6">
        <div className={`w-3/5 md:w-1/2 p-3 rounded-lg ${bubbleBg} shadow-sm space-y-2.5`}>
          <ShimmerBlock className="h-3.5 rounded w-11/12" />
          <ShimmerBlock className="h-3.5 rounded w-4/5" />
        </div>
      </div>
    );
  }

  // Assistant message (left-aligned)
  return (
    <div className="flex items-start mb-6">
      {/* Avatar placeholder */}
      <ShimmerBlock className="w-8 h-8 rounded-full mr-3 shrink-0 mt-1" />
      <div className={`flex-1 space-y-2.5 p-3 rounded-lg ${bubbleBg} shadow-sm`}>
        {/* Optional: Model name placeholder line */}
        <ShimmerBlock className="h-3 rounded w-1/4" />
        {/* Text lines */}
        <ShimmerBlock className="h-3.5 rounded w-full" />
        <ShimmerBlock className="h-3.5 rounded w-11/12" />
        <ShimmerBlock className="h-3.5 rounded w-4/5" />
      </div>
    </div>
  );
};

const SkeletonLoaderChatUI = () => {
  return (
    <div className="w-full h-full pt-2">
      <SkeletonMessage isUser={true} />
      <SkeletonMessage />
      <SkeletonMessage isUser={true} />
      <SkeletonMessage />
      {/* You can add more SkeletonMessage components if you want it to appear longer */}
      {/* <SkeletonMessage /> */}
      {/* <SkeletonMessage isUser={true} /> */}
      {/* <SkeletonMessage /> */}
    </div>
  );
};

export default SkeletonLoaderChatUI;