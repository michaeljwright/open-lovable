"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { appConfig } from '@/config/app.config';
import { toast } from "sonner";
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { BsChatLeft } from 'react-icons/bs';

// Import shared components
import { Connector } from "@/components/shared/layout/curvy-rect";
import AsciiExplosion from "@/components/shared/effects/flame/ascii-explosion";
import { HeaderProvider } from "@/components/shared/header/HeaderContext";

// Import hero section components
import HomeHeroBackground from "@/components/app/(home)/sections/hero/Background/Background";
import HomeHeroBadge from "@/components/app/(home)/sections/hero/Badge/Badge";
import HomeHeroTitle from "@/components/app/(home)/sections/hero/Title/Title";
import HeroInputSubmitButton from "@/components/app/(home)/sections/hero-input/Button/Button";

// Import header components
import HeaderWrapper from "@/components/shared/header/Wrapper/Wrapper";

export default function HomePage() {
  const [prompt, setPrompt] = useState<string>("");
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [showAnimation, setShowAnimation] = useState<boolean>(false);
  const [builderProgress, setBuilderProgress] = useState<string>("Create any website, in seconds..");
  const router = useRouter();

  const progressMessages = [
    "Building something wonderful..",
    "Crafting a logo for your brand..",
    "Selecting a colour palette..",
    "Choosing the layout and components..",
    "Finishing things off.."
  ];

  useEffect(() => {
    if (!showAnimation) return;

    let currentIndex = 0;
    setBuilderProgress(progressMessages[currentIndex]);

    const interval = setInterval(() => {
      currentIndex = (currentIndex + 1) % progressMessages.length;
      setBuilderProgress(progressMessages[currentIndex]);
    }, 3000);

    return () => clearInterval(interval);
  }, [showAnimation]);

  const handleSubmit = async () => {
    const inputValue = prompt.trim();

    if (!inputValue) {
      toast.error("Please describe what you want me to build");
      return;
    }

    setShowAnimation(true);
    setIsCreating(true);
    toast.loading('AI is generating your site...', { id: 'creating' });

    try {
      const startTime = Date.now();

      const response = await fetch('/api/create-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: inputValue }),
      });

      const elapsed = Date.now() - startTime;
      console.log(`[HomePage] Received response in ${elapsed}ms`);
      console.log('[HomePage] Response status:', response.status, response.statusText);

      if (response.ok) {
        const data = await response.json();
        console.log('[HomePage] Response data:', data);

        if (data.success) {
          console.log('[HomePage] ✓ Site generation successful!');
          console.log('[HomePage] Data structure:', data.puck.data);
          console.log('[HomePage] Config length:', data.puck.configJs?.length);

          // Store the site data and redirect to edit page
          const dataStr = JSON.stringify(data.puck.data);
          console.log('[HomePage] Storing siteData in sessionStorage, length:', dataStr.length);
          sessionStorage.setItem('siteData', dataStr);

          console.log('[HomePage] Storing siteConfig in sessionStorage, length:', data.puck.configJs.length);
          sessionStorage.setItem('siteConfig', data.puck.configJs);

          // Store the original prompt for context
          sessionStorage.setItem('originalPrompt', inputValue);

          // Store initial chat history
          const initialChat = [{
            content: `Creating a site: ${inputValue}`,
            type: 'user',
            timestamp: new Date().toISOString()
          }, {
            content: `I've generated your site with ${Object.keys(data.puck.data.content || []).length} components. You can now edit it visually or chat with me to make changes.`,
            type: 'ai',
            timestamp: new Date().toISOString()
          }];
          sessionStorage.setItem('chatHistory', JSON.stringify(initialChat));

          toast.success('Site generated successfully!', { id: 'creating' });

          console.log('[HomePage] Redirecting to /edit...');
          router.push('/edit');
        } else {
          console.error('[HomePage] Site generation failed:', data.error);
          toast.error(data.error || 'Failed to create site', { id: 'creating' });
        }
      } else {
        const errorData = await response.json();
        console.error('[HomePage] API error response:', errorData);
        toast.error(errorData.error || 'Failed to create site', { id: 'creating' });
      }
    } catch (error: any) {
      console.error('[HomePage] ✗ Error creating site:', error);
      console.error('[HomePage] Error message:', error?.message);
      console.error('[HomePage] Error stack:', error?.stack);
      toast.error('Failed to create site: ' + error?.message, { id: 'creating' });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <HeaderProvider>
      <div className="min-h-screen bg-background-base relative" id="home-page">
        {/* Lottie Background Animation */}
        {showAnimation && (
          <div className="fixed inset-0 z-0 pointer-events-none" style={{ transform: 'scale(0.8) translateY(-10%)' }}>
            <DotLottieReact
              src="/penultimate-builder-animation.lottie"
              loop
              autoplay
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        )}

        <div className="sticky top-0 left-0 w-full z-[101] bg-background-base header">
          <div className="absolute top-0 cmw-container border-x border-border-faint h-full pointer-events-none" />
          <div className="h-1 bg-border-faint w-full left-0 -bottom-1 absolute" />
          <div className="cmw-container absolute h-full pointer-events-none top-0">
            <Connector className="absolute -left-[10.5px] -bottom-11" />
            <Connector className="absolute -right-[10.5px] -bottom-11" />
          </div>

          <HeaderWrapper>
            <div className="max-w-[900px] mx-auto w-full flex justify-center items-center">
              <Link
                className="flex items-center gap-6"
                href="/"
              >
                <img src="/penultimate.png" alt="Logo" style={{ height: '60px', width: 'auto' }} />
                <HomeHeroTitle />
              </Link>
            </div>
          </HeaderWrapper>
        </div>

        {/* Hero Section */}
        <section className="overflow-x-clip" id="home-hero">
          <div className="pt-28 lg:pt-254 lg:-mt-100 pb-115 relative" id="hero-content">
            <HomeHeroBackground />

            <div className="relative container px-16">
              <div style={{ visibility: showAnimation ? 'hidden' : 'visible' }}>
                <HomeHeroBadge />
              </div>
              <div className="flex justify-center">
                <p
                  className="text-center text-body-large inline-block px-24 py-12 rounded-16"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.75)',
                    backdropFilter: 'blur(12px)',
                    boxShadow: '0 6px 24px rgba(0, 0, 0, 0.12), 0 3px 12px rgba(0, 0, 0, 0.08)'
                  }}
                >
                  { builderProgress }
                </p>
              </div>

            </div>
          </div>

          {/* Mini Playground Input */}
          <div className="container lg:contents !p-16 relative -mt-90">
            <div className="absolute top-0 left-[calc(50%-50vw)] w-screen h-1 bg-border-faint lg:hidden" />
            <div className="absolute bottom-0 left-[calc(50%-50vw)] w-screen h-1 bg-border-faint lg:hidden" />
            <Connector className="-top-10 -left-[10.5px] lg:hidden" />
            <Connector className="-top-10 -right-[10.5px] lg:hidden" />
            <Connector className="-bottom-10 -left-[10.5px] lg:hidden" />
            <Connector className="-bottom-10 -right-[10.5px] lg:hidden" />

            {/* Hero Input Component */}
            <div className="max-w-552 mx-auto z-[11] lg:z-[2]">
              <div className="rounded-20 -mt-30 lg:-mt-30">
                <div
                  className="bg-white rounded-20"
                  style={{
                    boxShadow:
                      "0px 0px 44px 0px rgba(0, 0, 0, 0.02), 0px 88px 56px -20px rgba(0, 0, 0, 0.03), 0px 56px 56px -20px rgba(0, 0, 0, 0.02), 0px 32px 32px -20px rgba(0, 0, 0, 0.03), 0px 16px 24px -12px rgba(0, 0, 0, 0.03), 0px 0px 0px 1px rgba(0, 0, 0, 0.05), 0px 0px 0px 10px #F9F9F9",
                  }}
                >
                  <div className="p-16 flex gap-12 items-center w-full relative bg-white rounded-20">
                    {/* Build icon */}
                    <BsChatLeft className="opacity-40 flex-shrink-0" size={20} />
                    
                    <input
                      className="flex-1 bg-transparent text-body-input text-accent-black placeholder:text-black-alpha-48 focus:outline-none focus:ring-0 focus:border-transparent"
                      placeholder="Describe what you want to build?"
                      type="text"
                      value={prompt}
                      disabled={isCreating}
                      onChange={(e) => {
                        setPrompt(e.target.value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !isCreating) {
                          e.preventDefault();
                          handleSubmit();
                        }
                      }}
                    />
                    
                    <div
                      onClick={(e) => {
                        e.preventDefault();
                        if (!isCreating) {
                          handleSubmit();
                        }
                      }}
                      className={isCreating ? 'pointer-events-none' : ''}
                    >
                      <HeroInputSubmitButton 
                        dirty={prompt.length > 0} 
                        buttonText="Build Site" 
                        disabled={isCreating}
                      />
                    </div>
                  </div>
                </div>

                <div className="h-248 top-84 cw-768 pointer-events-none absolute overflow-clip -z-10">
                  <AsciiExplosion className="-top-200" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </HeaderProvider>
  );
}
