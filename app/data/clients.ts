/**
 * Shared client/case study data for service pages and kundecaser.
 * Uses our images, business names, and one benefit per client.
 */

export interface ClientCase {
  slug: string;
  businessName: string;
  image: string;
  benefit: string;
}

export const clientCases: ClientCase[] = [
  {
    slug: 'superhero-burger',
    businessName: 'Superhero Burger',
    image: '/media/superhero capture.PNG',
    benefit: 'Konverter flere kunder',
  },
  {
    slug: 'svelstad-gardsbruk',
    businessName: 'Svelstad gårdsbruk',
    image: '/media/Svelstad.PNG',
    benefit: 'Ny begynnelse på nett',
  },
  {
    slug: 'vaernes-bar',
    businessName: 'Værnes bar',
    image: '/media/værnesbar website capture.PNG',
    benefit: 'Nr 1 på Google',
  },
  {
    slug: 'mong-sushi',
    businessName: 'Mong sushi',
    image: '/media/mong sushi capture.PNG',
    benefit: 'Økt konversjonsrate',
  },
  {
    slug: 'swich-restaurant',
    businessName: "S'wich restaurant",
    image: '/media/swich website.PNG',
    benefit: 'Nr 3 på Google',
  },
];
