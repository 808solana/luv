export type CloudLogo = {
  id: string;
  name: string;
  src: string;
  alt: string;
};

/** Unique marks for the Use Now logo cloud (circular + wipe). */
export const LOGOS: CloudLogo[] = [
  {
    id: "kimi-k3",
    name: "Kimi",
    src: "/BRAND_ASSETS/models/kimi.jpg",
    alt: "Kimi mark",
  },
  {
    id: "glm-5-3",
    name: "GLM",
    src: "/BRAND_ASSETS/models/glm.jpg",
    alt: "GLM z.ai mark",
  },
  {
    id: "deepseek-v4-flash",
    name: "Flash",
    src: "/BRAND_ASSETS/models/deepseek.jpg",
    alt: "DeepSeek whale mark",
  },
  {
    id: "deepseek-v4-pro",
    name: "Pro",
    src: "/BRAND_ASSETS/models/deepseek.jpg",
    alt: "DeepSeek whale mark",
  },
  {
    id: "qwen-3-8-27b",
    name: "Qwen",
    src: "/BRAND_ASSETS/models/qwen.jpg",
    alt: "Qwen mark",
  },
];
