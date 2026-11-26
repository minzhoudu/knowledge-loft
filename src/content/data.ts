/**
 * Everything the world shows about you. Shapes are checked against
 * ./schema.ts when this module loads.
 */

export const about = {
    name: 'Pavle Jovanović',
    headline: 'Senior full stack engineer · Team lead',
    location: 'Novi Sad, Serbia',
    timeZone: 'Europe/Belgrade',
    coordinates: { lat: 45.27, lon: 19.83 }, // Novi Sad (city centre)
    bio: 'Full stack engineer and team lead with six years of building for the web, mobile and ecommerce. Right now I lead frontend at Florbs, a Google Workspace security and automation platform, working across React, Python, Go and Kotlin. Before that: Next.js and NestJS products, React Native apps, AI features built on LLMs and RAG, and high-traffic stores for brands like FENDI Casa and Louis Poulsen. I like owning a feature end to end, from the database to the last pixel, and helping a team ship well.',
    links: [
        { label: 'GitHub', href: 'https://github.com/minzhoudu' },
        { label: 'LinkedIn', href: 'https://www.linkedin.com/in/jovanovixp/' },
    ],
    github: 'minzhoudu',
    cv: '/cv/pavle-jovanovic-cv.pdf',
};

export const projects = [
    {
        slug: 'moj-vulkanizer',
        title: 'Moj Vulkanizer',
        summary:
            'A booking platform for tire shops. Every shop gets its own subdomain, customers book through a chat-style flow, and owners run the day from a mobile-first admin panel. An availability engine handles hours, holidays, service bays and time zones, and a PostgreSQL exclusion constraint makes double bookings impossible. Push notifications (iOS included) and WhatsApp reminders keep everyone on time.',
        year: 2026,
        skills: [
            'nextjs',
            'react',
            'typescript',
            'postgresql',
            'drizzle',
            'tailwind',
            'better-auth',
            'vitest',
            'pwa',
            'github-actions',
            'vercel',
            'neon',
            'docker',
        ],
        links: [{ label: 'mojvulkanizer.com', href: 'https://mojvulkanizer.com/' }],
        featured: true,
    },
    {
        slug: 'knowledge-loft',
        title: 'Knowledge Loft',
        summary:
            'This place. A first-person 3D portfolio you can walk through, with the real sun path and live weather of Novi Sad, synthesised ambient sound, and every room built from data. A playground for learning 3D rendering, shaders and, next, AI.',
        year: 2026,
        skills: ['nextjs', 'react', 'typescript', 'threejs', 'webgl', 'web-audio'],
        links: [{ label: 'Source on GitHub', href: 'https://github.com/minzhoudu/knowledge-loft' }],
    },
    {
        slug: 'florbs-workspace-security',
        title: 'Florbs: Google Workspace security',
        summary:
            'Leading the frontend of a B2B platform that secures and automates Google Workspace: Drive sharing audits, security posture scoring, risk ratings for third-party apps and AI tools, workflow automation and backup, plus an internal admin tool for support and sales.',
        year: 2025,
        skills: [
            'react',
            'typescript',
            'python',
            'go',
            'kotlin',
            'bigquery',
            'postgresql',
            'gcp',
            'terraform',
        ],
    },
    {
        slug: 'ai-energy-booking',
        title: 'AI energy optimisation and booking',
        summary:
            'A platform that books energy-hungry work for when it is cheapest, with Python models behind a Next.js app. Alongside it, an internal RAG assistant that answers questions over product documentation and analytics data, running on AWS Bedrock.',
        year: 2025,
        skills: ['nextjs', 'python', 'llm', 'rag', 'aws', 'bedrock'],
    },
    {
        slug: 'source-greenhouse-analytics',
        title: 'Source: greenhouse analytics',
        summary:
            'Frontend and backend for a greenhouse analytics platform: real-time sensor data, yield prediction simulations, and side-by-side comparisons across greenhouses.',
        year: 2024,
        skills: ['nextjs', 'graphql', 'nestjs', 'typescript'],
    },
    {
        slug: 'lilly-drogerie',
        title: 'Lilly Drogerie web shop',
        summary:
            "Merged a drugstore chain's web shop and marketing site into a single Magento 2 platform, added a loyalty programme and reworked the UX.",
        year: 2023,
        skills: ['magento', 'php', 'javascript'],
    },
    {
        slug: 'luxury-design-ecommerce',
        title: 'Ecommerce for design brands',
        summary:
            'Backend features on Salesforce Commerce Cloud for Flos, B&B Italia, Louis Poulsen and FENDI Casa: Adyen payments with fraud detection, multi-address shipping and a Google Maps store locator.',
        year: 2022,
        skills: ['salesforce-commerce-cloud', 'nodejs', 'adyen', 'google-maps'],
    },
    {
        slug: 'pasionis',
        title: 'Pasionis',
        summary:
            'Booking app for a hair studio. Clients pick a day and a free slot; staff accept or cancel bookings and set their working hours from an admin dashboard.',
        year: 2021,
        skills: ['nextjs', 'react'],
    },
    {
        slug: 'recognai',
        title: 'RecognAi',
        summary:
            'Face recognition with a twist: every face found in your photos (via the Clarifai API) earned a point, and points turned into discount codes from partner shops.',
        year: 2020,
        skills: ['react', 'express', 'mysql', 'clarifai'],
    },
    {
        slug: 'eurocompass',
        title: 'Eurocompass',
        summary:
            'Bus seat reservations in React, deployed on Netlify, with serverless functions that email each booking request to the bus station.',
        year: 2020,
        skills: ['react', 'netlify', 'serverless'],
    },
];

export const companies = [
    {
        slug: 'florbs',
        name: 'Florbs',
        role: 'Frontend team lead · Full stack engineer',
        start: '2025-04',
        end: null,
        summary:
            'Leading a frontend team of four on a Google Workspace security and automation platform (Netherlands, remote). Building features end to end: React and TypeScript on the front, Python APIs behind them, and later Go and Kotlin services.',
        skills: [
            'react',
            'typescript',
            'python',
            'go',
            'kotlin',
            'bigquery',
            'postgresql',
            'gcp',
            'terraform',
        ],
    },
    {
        slug: 'nortik',
        name: 'Nortik Software Solutions',
        role: 'Team lead',
        start: '2025-04',
        end: '2026-04',
        summary:
            'Led a team of three across five client projects, owning delivery and code quality for Next.js and NestJS web apps and React Native mobile apps. Set up and ran the AWS infrastructure for all of them, and built AI features including a RAG assistant.',
        skills: ['nextjs', 'nestjs', 'react-native', 'aws', 'python', 'llm', 'rag'],
    },
    {
        slug: 'nqode',
        name: 'nQode Solutions',
        role: 'Full stack engineer',
        start: '2024-03',
        end: '2025-04',
        summary:
            'Client work, mostly on Source, a greenhouse analytics platform: real-time sensor data, yield prediction and comparisons, built with Next.js, GraphQL and NestJS.',
        skills: ['nextjs', 'graphql', 'nestjs', 'typescript'],
    },
    {
        slug: 'bee-it-magento',
        name: 'Bee IT',
        role: 'Magento 2 developer',
        start: '2023-08',
        end: '2024-03',
        summary:
            "Merged Lilly Drogerie's web shop and marketing site into one Magento 2 platform, built a loyalty programme and improved the UX across full stack features.",
        skills: ['magento', 'php', 'javascript'],
    },
    {
        slug: 'bee-it-sfcc',
        name: 'Bee IT',
        role: 'Salesforce Commerce Cloud developer',
        start: '2021-06',
        end: '2023-08',
        summary:
            'Backend ecommerce features in Node.js on SFCC for Flos, B&B Italia, Louis Poulsen and FENDI Casa: Adyen payments and fraud detection, multi-shipping and a store locator.',
        skills: ['salesforce-commerce-cloud', 'nodejs', 'adyen'],
    },
    {
        slug: 'freelance',
        name: 'Freelance',
        role: 'Full stack developer',
        start: '2020-01',
        end: null,
        summary:
            'Where it started, and still going alongside the day job: booking apps for a hair studio and a bus company, a face recognition app with a rewards scheme, and client work since, built with React, Next.js and Express.',
        skills: ['react', 'nextjs', 'express', 'mysql'],
    },
];

export const hobbies = [
    {
        slug: 'learning-and-ai',
        name: 'Code, languages and AI',
        summary:
            "Programming doesn't stop when work does. I pick up new languages for the fun of seeing how they think, and I follow what's new in AI closely: what models can do now, and how to build them into real systems in ways that actually help.",
    },
    {
        slug: 'scuba-diving',
        name: 'Scuba diving',
        summary:
            "A certified diver with more than eight years underwater. Diving is the one place my phone can't follow me: slow breathing, total focus, and a world that looks nothing like a screen.",
    },
    {
        slug: 'reading',
        name: 'Reading',
        summary:
            'Mostly epic fantasy and spy fiction: The Witcher, A Song of Ice and Fire, James Bond. Long stories with big worlds, sharp politics and characters who have to think their way out.',
    },
    {
        slug: 'co-op-games',
        name: 'Co-op games with friends',
        summary:
            'Survival and co-op games, played with the same group of friends. Building a base together, planning a run, and failing loudly is my favourite kind of teamwork outside work.',
    },
];

/**
 * Every skill that projects and roles can list. Each one becomes a star in
 * the lobby's skill constellation; a skill no project uses yet is still
 * shown, just small. Unknown slugs in projects or roles fail the build.
 */
export const skills = [
    // Languages
    { slug: 'typescript', name: 'TypeScript', category: 'language' },
    { slug: 'javascript', name: 'JavaScript', category: 'language' },
    { slug: 'python', name: 'Python', category: 'language' },
    { slug: 'go', name: 'Go', category: 'language' },
    { slug: 'kotlin', name: 'Kotlin', category: 'language' },
    { slug: 'php', name: 'PHP', category: 'language' },
    // Frontend & mobile
    { slug: 'react', name: 'React', category: 'frontend' },
    { slug: 'nextjs', name: 'Next.js', category: 'frontend' },
    { slug: 'react-native', name: 'React Native', category: 'frontend' },
    { slug: 'tailwind', name: 'Tailwind CSS', category: 'frontend' },
    { slug: 'pwa', name: 'PWA', category: 'frontend' },
    { slug: 'vite', name: 'Vite', category: 'frontend' },
    { slug: 'mui', name: 'MUI', category: 'frontend' },
    { slug: 'threejs', name: 'three.js', category: 'frontend' },
    { slug: 'webgl', name: 'WebGL', category: 'frontend' },
    { slug: 'web-audio', name: 'Web Audio', category: 'frontend' },
    // Backend & APIs
    { slug: 'nodejs', name: 'Node.js', category: 'backend' },
    { slug: 'nestjs', name: 'NestJS', category: 'backend' },
    { slug: 'express', name: 'Express', category: 'backend' },
    { slug: 'graphql', name: 'GraphQL', category: 'backend' },
    { slug: 'drizzle', name: 'Drizzle ORM', category: 'backend' },
    { slug: 'better-auth', name: 'Better Auth', category: 'backend' },
    // Data
    { slug: 'postgresql', name: 'PostgreSQL', category: 'data' },
    { slug: 'mysql', name: 'MySQL', category: 'data' },
    { slug: 'mongodb', name: 'MongoDB', category: 'data' },
    { slug: 'bigquery', name: 'BigQuery', category: 'data' },
    // Cloud & DevOps
    { slug: 'aws', name: 'AWS', category: 'devops' },
    { slug: 'gcp', name: 'Google Cloud', category: 'devops' },
    { slug: 'terraform', name: 'Terraform', category: 'devops' },
    { slug: 'docker', name: 'Docker', category: 'devops' },
    { slug: 'github-actions', name: 'GitHub Actions', category: 'devops' },
    { slug: 'vitest', name: 'Vitest', category: 'devops' },
    { slug: 'vercel', name: 'Vercel', category: 'devops' },
    { slug: 'neon', name: 'Neon', category: 'devops' },
    { slug: 'netlify', name: 'Netlify', category: 'devops' },
    { slug: 'serverless', name: 'Serverless functions', category: 'devops' },
    // AI & LLMs
    { slug: 'llm', name: 'LLM integration', category: 'ai' },
    { slug: 'rag', name: 'RAG', category: 'ai' },
    { slug: 'bedrock', name: 'AWS Bedrock', category: 'ai' },
    { slug: 'langchain', name: 'LangChain', category: 'ai' },
    { slug: 'pinecone', name: 'Pinecone', category: 'ai' },
    { slug: 'clarifai', name: 'Clarifai', category: 'ai' },
    { slug: 'agentic-coding', name: 'Agentic coding', category: 'ai' },
    // Ecommerce & integrations
    { slug: 'salesforce-commerce-cloud', name: 'Salesforce Commerce Cloud', category: 'commerce' },
    { slug: 'magento', name: 'Magento 2', category: 'commerce' },
    { slug: 'adyen', name: 'Adyen', category: 'commerce' },
    { slug: 'stripe', name: 'Stripe', category: 'commerce' },
    { slug: 'google-maps', name: 'Google Maps', category: 'commerce' },
] as const;

/**
 * The "currently" board in the lobby. Keep titles short (they're spelled out
 * in letters on a felt board) and bump `updated` whenever you change it.
 */
export const currently = {
    updated: '2026-11-26',
    items: [
        {
            kind: 'building',
            title: 'Knowledge Loft',
            detail: 'This place: a walkable 3D portfolio with real sun, live weather and GitHub data. Next up, an AI guide.',
            link: {
                label: 'Source on GitHub',
                href: 'https://github.com/minzhoudu/knowledge-loft',
            },
            repo: 'knowledge-loft',
        },
        {
            kind: 'working',
            title: 'Florbs',
            detail: 'Leading frontend on a Google Workspace security and automation platform.',
        },
        {
            kind: 'learning',
            title: '3D, shaders & AI agents',
            detail: 'three.js and GLSL for this loft, and building LLM features into real products.',
        },
    ],
};
