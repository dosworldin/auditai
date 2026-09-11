/**
 * Readymade sample storybooks — fully pre-written, no AI calls, zero marginal
 * cost. Each sample is a complete 2-page "cartoon" mini-book that shows how a
 * real order looks (illustrated scenes + story text) without uploading a
 * photo. Anyone of any age can preview them; the hero is a friendly cartoon
 * character instead of the user's child.
 *
 * Illustrations are generated ONCE lazily by /api/storybook/samples/seed
 * through the same illustration pipeline and mirrored into the private bucket
 * under samples/<slug>/p1.png — after that every view is a pure read.
 */

export interface SampleStory {
  slug: string;
  title: string;
  tagline: string;
  emoji: string;
  heroDescription: string;
  artStyle: string;
  ageRange: string;
  pages: { text: string; illustrationPrompt: string }[];
}

export const SAMPLE_STORIES: SampleStory[] = [
  {
    slug: "luna-and-the-moon-rocket",
    title: "Luna and the Moon Rocket",
    tagline: "A 2-page space adventure for dreamers of every age",
    emoji: "🚀",
    heroDescription: "a cheerful cartoon kid explorer with round glasses and a red scarf",
    artStyle: "cartoon",
    ageRange: "All ages",
    pages: [
      {
        text: "Luna built a rocket from an old bathtub, three springs, and a lot of courage. \"Ten... nine... eight...\" she counted, while her cat Copernicus strapped in beside her. The stars leaned closer, just to listen.",
        illustrationPrompt:
          "A cheerful cartoon kid explorer with round glasses and a red scarf sitting in a homemade rocket made from a bathtub, a chubby cat beside her, counting down with a grin, cartoon night sky full of friendly smiling stars, vibrant flat cartoon illustration, bold outlines, playful",
      },
      {
        text: "On the Moon, the craters were full of trampolines. Luna bounced so high she tickled the constellations, and Copernicus chased stardust mice all the way home. \"Same time tomorrow?\" the Moon whispered. Luna smiled. \"Every day.\"",
        illustrationPrompt:
          "The same cheerful cartoon kid explorer with round glasses and a red scarf bouncing on a glowing crater trampoline on the Moon, her cat chasing sparkling stardust mice, Earth glowing softly in the starry sky, joyful cartoon energy, vibrant flat cartoon illustration, bold outlines",
      },
    ],
  },
  {
    slug: "the-tea-shop-at-the-end-of-the-lane",
    title: "The Tea Shop at the End of the Lane",
    tagline: "A cozy 2-page tale about kindness (great for grown-ups too)",
    emoji: "🍵",
    heroDescription: "a kind elderly cartoon shopkeeper with a long grey moustache and round spectacles",
    artStyle: "watercolor",
    ageRange: "All ages",
    pages: [
      {
        text: "Mr. Idris had served exactly one thousand cups of tea at the little shop at the end of the lane. Every cup came with a free story, and every story was better than the last. The town swore his kettle hummed old songs.",
        illustrationPrompt:
          "A kind elderly cartoon shopkeeper with a long grey moustache and round spectacles pouring steaming tea in a tiny cozy tea shop, mismatched chairs, warm lanterns, a humming brass kettle, soft watercolor children's book illustration, gentle washes, warm palette",
      },
      {
        text: "One rainy evening a traveler arrived with empty pockets and a heavy heart. Mr. Idris slid a steaming cup across the counter and said, \"This one's free — but you'll owe me a story someday.\" Years later, that traveler opened a tea shop of her own. The kettle hummed there too.",
        illustrationPrompt:
          "The same kind elderly cartoon shopkeeper with a long grey moustache sliding a warm teacup to a tired young traveler in a rainy window-lit tea shop, two chairs, steam swirling like tiny dancing clouds, hopeful mood, soft watercolor children's book illustration, gentle washes",
      },
    ],
  },
  {
    slug: "the-dragon-who-was-scared-of-mornings",
    title: "The Dragon Who Was Scared of Mornings",
    tagline: "A funny 2-page bedtime story for little and big dragons",
    emoji: "🐉",
    heroDescription: "a small round green cartoon dragon with tiny wings and a striped nightcap",
    artStyle: "cartoon",
    ageRange: "All ages",
    pages: [
      {
        text: "Pip was a dragon with one big problem: mornings. Alarms? Terrifying. Sunbeams? Too bright. Toast? Untrustworthy. So Pip pulled his striped nightcap down low and hid under one very grumpy blanket until the world agreed to start without him.",
        illustrationPrompt:
          "A small round green cartoon dragon with tiny wings and a striped nightcap hiding under a big blanket in a cozy cave bedroom, one eye peeking out suspiciously, alarm clock running away in fear, morning light outside, funny cartoon style, bold outlines, cheerful",
      },
      {
        text: "Then one morning a lost baby sun rolled into his cave, cold and dim. Pip wrapped it in his blanket and told it a brave story about toast. The sun giggled, warmed up, and rose right out of the cave. Now every sunrise belongs to Pip — the dragon who tamed mornings.",
        illustrationPrompt:
          "The same small round green cartoon dragon with a striped nightcap wrapping a glowing baby sun in a blanket inside his cave, the sun smiling warmly, golden light flooding the cave entrance, celebratory mood, funny cartoon style, bold outlines, cheerful",
      },
    ],
  },
  {
    slug: "grandmas-secret-recipe",
    title: "Grandma's Secret Recipe",
    tagline: "A heart-warming 2-page story the whole family can share",
    emoji: "🥧",
    heroDescription: "a smiling cartoon grandmother with a floral apron and silver bun",
    artStyle: "storybook",
    ageRange: "All ages",
    pages: [
      {
        text: "Everyone in Maple Street knew Grandma Nila's pies were magic. Not sparkle-and-wand magic — better. One bite of her mango pie, and people remembered their favorite day. The recipe card had only three words: \"Make it with love.\"",
        illustrationPrompt:
          "A smiling cartoon grandmother with a floral apron and silver bun taking a golden mango pie out of a warm oven in a cottage kitchen, grandchildren peeking through the doorway, flour dust sparkling in sunlight, classic storybook ink-and-gouache illustration, whimsical, detailed",
      },
      {
        text: "When it was finally time to hand over the recipe, she gave it to the whole street — because a secret shared at a long table with everyone laughing isn't a secret anymore. It's a tradition. And traditions, she winked, are the best kind of magic.",
        illustrationPrompt:
          "The same smiling cartoon grandmother with a floral apron and silver bun at a long outdoor table full of happy neighbors sharing pie slices, string lights overhead, children and elders laughing together, warm evening glow, classic storybook ink-and-gouache illustration, whimsical",
      },
    ],
  },
];

export function getSample(slug: string): SampleStory | undefined {
  return SAMPLE_STORIES.find((s) => s.slug === slug);
}

/** Bucket path of a sample's page illustration. */
export function sampleImagePath(slug: string, pageNumber: number): string {
  return `samples/${slug}/p${pageNumber}.png`;
}

/** Internal-only page structure mirroring storybook page rows. */
export function samplePages(sample: SampleStory): {
  pageNumber: number;
  text: string;
  illustrationPrompt: string;
  imageUrl: string | null;
  generationId: string | null;
  storagePath: string;
}[] {
  return sample.pages.map((p, i) => ({
    pageNumber: i + 1,
    text: p.text,
    illustrationPrompt: p.illustrationPrompt,
    imageUrl: null,
    generationId: null,
    storagePath: sampleImagePath(sample.slug, i + 1),
  }));
}
