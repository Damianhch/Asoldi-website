import React from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { SalesCTA } from '../components/SalesCTA';
import { FAQ } from '../components/FAQ';
import { SEO } from '../components/SEO';
import { getAboutPageSchema } from '../structuredData';
import { BUSINESS, SITE_URL } from '../config';

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const } },
};

const services = [
  {
    title: 'Nettsideutvikling',
    text: 'Raske, tydelige nettsider som gjør det enkelt for kundene å finne dere, bestille og ta kontakt.',
    href: '/services/web-development',
  },
  {
    title: 'Sosiale medier',
    text: 'Innhold og tilstedeværelse der målgruppen allerede er, med en stemme som høres ut som bedriften.',
    href: '/services/social-media',
  },
  {
    title: 'Digital strategi',
    text: 'Færre løse tiltak, mer sammenheng. Vi velger det som faktisk flytter merkevaren, ikke alt på en gang.',
    href: '/pricing',
  },
];

const clients = ['Svelstad', 'Swich', 'Mong Sushi', 'Superhero Invest', 'Værnes Bar', 'Byneset Bydelskafe', 'Arman V', 'Asoldi'];

export const AboutUs = () => {
  return (
    <div className="bg-[#050505] text-white">
      <SEO
        title={`Om oss – ${BUSINESS.shortName} | Studentdrevet byrå i Trondheim`}
        description="Asoldi er et studentdrevet digitalt byrå i Trondheim. Vi tilbyr premium markedsføringstjenester og hjelper bedrifter med å vokse på nett."
        path="/about"
        structuredData={getAboutPageSchema('Om Asoldi', BUSINESS.description, SITE_URL + '/about')}
      />

      <section className="px-2 pt-20 md:px-4 md:pt-24">
        <div className="relative min-h-[calc(100svh-5.5rem)] overflow-hidden rounded-[24px] md:rounded-[40px]">
          <motion.img
            src="/media/DSC02166-scaled.webp"
            alt="Asoldi-teamet"
            className="absolute inset-0 h-full w-full object-cover"
            initial={{ scale: 1.08 }}
            animate={{ scale: 1 }}
            transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/45 to-[#050505]/15" />
          <div className="relative z-10 flex min-h-[calc(100svh-5.5rem)] flex-col justify-end p-6 md:p-14 lg:p-16">
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.6 }}
              className="mb-4 text-xs font-medium uppercase tracking-[0.28em] text-[#FF5B00] md:text-sm"
            >
              Studentdrevet byrå · Trondheim
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.7 }}
              className="max-w-5xl text-5xl font-medium tracking-tight md:text-7xl lg:text-8xl"
            >
              Dette er Asoldi
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.7 }}
              className="mt-5 max-w-xl text-base font-light leading-relaxed text-white/80 md:text-xl"
            >
              Vi hjelper bedrifter å vokse med design og teknologi som ser bra ut, og som kundene faktisk bruker.
            </motion.p>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1440px] gap-10 px-6 py-24 md:px-10 lg:grid-cols-2 lg:items-center lg:gap-20 lg:py-32">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          className="overflow-hidden rounded-[28px] md:rounded-[40px]"
        >
          <img
            src="/media/asoldi%20capture%202.PNG"
            alt="Arbeid fra Asoldi"
            className="aspect-[4/5] w-full object-cover md:aspect-[4/5]"
          />
        </motion.div>
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
        >
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.22em] text-[#FF5B00]">Hva vi gjør</p>
          <h2 className="text-4xl font-medium tracking-tight leading-[1.05] md:text-6xl">
            Vi hjelper bedrifter å vokse.
          </h2>
          <p className="mt-6 max-w-xl text-base font-light leading-relaxed text-white/65 md:text-xl">
            Gjennom strategisk design og moderne teknologi forvandler vi ideer til digitale opplevelser som skaper ekte resultater. Vi starter med utfordringen deres, og bygger løsningen rundt den.
          </p>
          <div className="mt-10 grid grid-cols-3 gap-4 border-t border-white/10 pt-8">
            {[
              ['Trondheim', 'Der vi holder til'],
              ['Studentdrevet', 'Oppdatert og tett på'],
              ['Premium', 'Til en rettferdig pris'],
            ].map(([title, label]) => (
              <div key={title}>
                <p className="text-sm font-medium text-white md:text-base">{title}</p>
                <p className="mt-1 text-xs text-white/45 md:text-sm">{label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      <section className="border-y border-white/10 bg-[#0a0a0a]">
        <div className="mx-auto grid max-w-[1440px] items-center gap-12 px-6 py-24 md:px-10 lg:grid-cols-2 lg:gap-20 lg:py-32">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            className="order-2 lg:order-1"
          >
            <div className="mb-6 inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-white/80 md:text-sm">
              Vår historie
            </div>
            <h2 className="text-4xl font-medium tracking-tight leading-[1.05] md:text-6xl">
              Studentdrevet innovasjon
            </h2>
            <p className="mt-6 max-w-xl text-base font-light leading-relaxed text-white/65 md:text-xl">
              Asoldi startet som en visjon om å tilby premium markedsføringstjenester til en rettferdig pris. Som et studentdrevet byrå i Trondheim tar vi med oss energi, oppdatert kunnskap og en ekte interesse for veksten til kundene våre.
            </p>
          </motion.div>
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            className="order-1 lg:order-2"
          >
            <div className="relative mx-auto max-w-md">
              <div className="absolute inset-0 translate-x-3 translate-y-3 rounded-[28px] bg-gradient-to-tr from-[#FF5B00]/30 to-transparent md:translate-x-4 md:translate-y-4" />
              <img
                src="/media/employee1.webp"
                alt="En fra Asoldi-teamet"
                className="relative z-10 aspect-square w-full rounded-[28px] object-cover"
              />
            </div>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-6 py-24 md:px-10 lg:py-32">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          className="mb-12 max-w-3xl"
        >
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.22em] text-[#FF5B00]">Tjenester</p>
          <h2 className="text-4xl font-medium tracking-tight md:text-6xl">Våre kjerntjenester</h2>
          <p className="mt-5 text-base font-light leading-relaxed text-white/60 md:text-xl">
            Vi holder oss til noen få ting, slik at hvert samarbeid får kvalitet og resultater som kan måles.
          </p>
        </motion.div>
        <div className="grid gap-4 md:grid-cols-3">
          {services.map((service, index) => (
            <motion.div
              key={service.title}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: index * 0.08 }}
            >
              <Link
                to={service.href}
                className="group flex h-full flex-col justify-between rounded-[28px] border border-white/10 bg-[#111] p-7 transition-colors hover:border-[#FF5B00]/50 md:p-8"
              >
                <div>
                  <p className="text-sm text-white/35">0{index + 1}</p>
                  <h3 className="mt-6 text-2xl font-medium tracking-tight">{service.title}</h3>
                  <p className="mt-4 text-sm font-light leading-relaxed text-white/60 md:text-base">{service.text}</p>
                </div>
                <span className="mt-10 inline-flex items-center gap-2 text-sm text-[#FF5B00]">
                  Les mer
                  <ArrowUpRight size={16} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="px-6 pb-8 md:px-10">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          className="mx-auto max-w-4xl rounded-[32px] border border-[#FF5B00]/30 bg-[#FF5B00]/10 px-6 py-12 text-center backdrop-blur-md md:rounded-[40px] md:px-16 md:py-16"
        >
          <h2 className="text-3xl font-medium tracking-tight md:text-6xl">En helhetlig merkevare</h2>
          <p className="mx-auto mt-5 max-w-2xl text-base font-light leading-relaxed text-white/70 md:text-2xl">
            Vær der kundene dine er. Disse tjenestene er grunnlaget for en moderne merkevare. Det handler om å bygge det som betyr noe for veksten, ikke å selge alt.
          </p>
        </motion.div>
      </section>

      <section className="overflow-hidden py-28">
        <div className="mx-auto mb-16 max-w-7xl px-6 text-center md:px-10">
          <h2 className="text-4xl font-medium tracking-tight md:text-7xl">Uttrykk din merkevare</h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg font-light text-white/50">
            Bedrifter som har brukt oss for å løfte den digitale tilstedeværelsen sin.
          </p>
        </div>
        <div className="flex w-full opacity-70">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex flex-shrink-0 animate-marquee items-center gap-16 pr-16" aria-hidden={copy === 1}>
              {clients.map((name) => (
                <div key={`${copy}-${name}`} className="text-3xl font-bold uppercase tracking-tighter text-white md:text-5xl">
                  {name}
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <SalesCTA />
      <FAQ />
    </div>
  );
};
