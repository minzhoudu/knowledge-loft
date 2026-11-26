/**
 * Placeholder content. Replace every entry with your real information.
 * Shapes are checked against ./schema.ts when this module loads.
 */

export const about = {
    name: 'Pavle Jovanović',
    headline: 'Software engineer',
    location: 'Novi Sad, Serbia',
    timeZone: 'Europe/Belgrade',
    bio: 'Two or three sentences about who you are, what you work on, and what you care about. This text shows up in the 3D world, on the quick view page, and later feeds the AI assistant.',
    links: [
        { label: 'GitHub', href: 'https://github.com/' },
        { label: 'LinkedIn', href: 'https://www.linkedin.com/' },
    ],
};

export const projects = [
    {
        slug: 'sample-project-one',
        title: 'Sample project one',
        summary: "One line about what it does and who it's for.",
        year: 2026,
        skills: ['typescript', 'react', 'threejs'],
        featured: true,
    },
    {
        slug: 'sample-project-two',
        title: 'Sample project two',
        summary: 'Another project. Keep summaries short; details go on the project page later.',
        year: 2025,
        skills: ['node', 'postgres'],
    },
    {
        slug: 'sample-project-three',
        title: 'Sample project three',
        summary: 'A third placeholder, so the gallery has more than one wall exhibit.',
        year: 2024,
        skills: ['python'],
    },
    {
        slug: 'sample-project-four',
        title: 'Sample project four',
        summary: 'A fourth placeholder. Delete or replace these with your real projects.',
        year: 2023,
        skills: ['go', 'docker'],
    },
];

export const companies = [
    {
        slug: 'current-company',
        name: 'Current Company',
        role: 'Senior Engineer',
        start: '2023-04',
        end: null,
        summary: 'What you do there, in one or two sentences.',
        skills: ['typescript', 'react'],
    },
    {
        slug: 'previous-company',
        name: 'Previous Company',
        role: 'Engineer',
        start: '2020-01',
        end: '2023-03',
        summary: 'What you did there, in one or two sentences.',
        skills: ['node'],
    },
];

export const hobbies = [
    { slug: 'hobby-one', name: 'Hobby one', summary: 'Why you love it, in a sentence.' },
    { slug: 'hobby-two', name: 'Hobby two', summary: 'Why you love it, in a sentence.' },
];
