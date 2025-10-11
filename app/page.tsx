"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { appConfig } from '@/config/app.config';
import { toast } from "sonner";

// Import shared components
import { Connector } from "@/components/shared/layout/curvy-rect";
import HeroFlame from "@/components/shared/effects/flame/hero-flame";
import AsciiExplosion from "@/components/shared/effects/flame/ascii-explosion";
import { HeaderProvider } from "@/components/shared/header/HeaderContext";

// Import hero section components
import HomeHeroBackground from "@/components/app/(home)/sections/hero/Background/Background";
import { BackgroundOuterPiece } from "@/components/app/(home)/sections/hero/Background/BackgroundOuterPiece";
import HomeHeroBadge from "@/components/app/(home)/sections/hero/Badge/Badge";
import HomeHeroPixi from "@/components/app/(home)/sections/hero/Pixi/Pixi";
import HomeHeroTitle from "@/components/app/(home)/sections/hero/Title/Title";
import HeroInputSubmitButton from "@/components/app/(home)/sections/hero-input/Button/Button";
// import Globe from "@/components/app/(home)/sections/hero-input/_svg/Globe";

// Import header components
import HeaderBrandKit from "@/components/shared/header/BrandKit/BrandKit";
import HeaderWrapper from "@/components/shared/header/Wrapper/Wrapper";
import HeaderDropdownWrapper from "@/components/shared/header/Dropdown/Wrapper/Wrapper";
import GithubIcon from "@/components/shared/header/Github/_svg/GithubIcon";
import ButtonUI from "@/components/ui/shadcn/button"


export default function HomePage() {
  const [prompt, setPrompt] = useState<string>("");
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const router = useRouter();
  


  const handleSubmit = async () => {
    const inputValue = prompt.trim();

    if (!inputValue) {
      toast.error("Please describe what you want me to build");
      return;
    }

    console.log('[HomePage] Starting site creation...');
    console.log('[HomePage] User prompt:', inputValue);

    setIsCreating(true);
    toast.loading('AI is generating your site...', { id: 'creating' });

    try {
      console.log('[HomePage] Sending request to /api/create-site...');
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
      <div className="min-h-screen bg-background-base">
        {/* Header/Navigation Section */}
        <HeaderDropdownWrapper />

        <div className="sticky top-0 left-0 w-full z-[101] bg-background-base header">
          <div className="absolute top-0 cmw-container border-x border-border-faint h-full pointer-events-none" />
          <div className="h-1 bg-border-faint w-full left-0 -bottom-1 absolute" />
          <div className="cmw-container absolute h-full pointer-events-none top-0">
            <Connector className="absolute -left-[10.5px] -bottom-11" />
            <Connector className="absolute -right-[10.5px] -bottom-11" />
          </div>

          <HeaderWrapper>
            <div className="max-w-[900px] mx-auto w-full flex justify-between items-center">
              <div className="flex gap-24 items-center">
                <HeaderBrandKit />
              </div>
            </div>
          </HeaderWrapper>
        </div>

        {/* Hero Section */}
        <section className="overflow-x-clip" id="home-hero">
          <div className="pt-28 lg:pt-254 lg:-mt-100 pb-115 relative" id="hero-content">
            <HomeHeroPixi />
            <HeroFlame />
            <BackgroundOuterPiece />
            <HomeHeroBackground />

            <div className="relative container px-16">
              <HomeHeroBadge />
              <HomeHeroTitle />
              <p className="text-center text-body-large">
                Re-imagine any website, in seconds.
              </p>
              
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
                  <svg 
                    width="20" 
                    height="20" 
                    viewBox="0 0 20 20" 
                    fill="none" 
                    xmlns="http://www.w3.org/2000/svg"
                    className="opacity-40 flex-shrink-0"
                  >
                    <path d="M10 2L3 7V18H17V7L10 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M7 18V12H13V18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  
                  <input
                    className="flex-1 bg-transparent text-body-input text-accent-black placeholder:text-black-alpha-48 focus:outline-none focus:ring-0 focus:border-transparent"
                    placeholder="What do you want me to build?"
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