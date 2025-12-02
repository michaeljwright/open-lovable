import { AnimatePresence, motion } from "motion/react";

import AnimatedWidth from "@/components/shared/layout/animated-width";
import ArrowRight from "@/components/app/(home)/sections/hero-input/_svg/ArrowRight";
import Button from "@/components/shared/button/Button";

function AnimatedDots() {
  return (
    <span className="inline-flex">
      <motion.span
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
      >
        .
      </motion.span>
      <motion.span
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
      >
        .
      </motion.span>
      <motion.span
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
      >
        .
      </motion.span>
    </span>
  );
}

export default function HeroInputSubmitButton({
  dirty,
  buttonText = "Re-imagine Site",
  disabled = false,
}: {
  dirty: boolean;
  buttonText?: string;
  disabled?: boolean;
}) {
  const loadingText = buttonText.replace(" Site", "ing");

  return (
    <Button
      className={`hero-input-button !p-0 ${disabled ? 'bg-gray-400 hover:bg-gray-400 cursor-wait' : 'bg-heat-100 hover:bg-heat-200'}`}
      size="large"
      variant="primary"
      disabled={disabled}
    >
      <AnimatedWidth>
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, x: -10, filter: "blur(2px)" }}
            initial={{ opacity: 0, x: 10, filter: "blur(2px)" }}
            key={disabled ? "loading" : (dirty ? "dirty" : "clean")}
          >
            {disabled ? (
              <div className="py-8 w-126 text-center text-white">
                {loadingText}
                <AnimatedDots />
              </div>
            ) : dirty ? (
              <div className="py-8 w-126 text-center text-white">
                {buttonText}
              </div>
            ) : (
              <div className="w-60 py-8 flex-center">
                <ArrowRight />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </AnimatedWidth>
    </Button>
  );
}
