import React from 'react';
import { Link } from 'react-router-dom';
import { LegalLayout, LegalSection, LegalSubheading, LegalList } from '../../components/legal/LegalLayout';

export const Informasjonskapsler = () => {
  return (
    <LegalLayout
      title="Informasjonskapsler"
      description="Hvordan asoldi.com bruker informasjonskapsler (cookies) og lignende teknologi, hvilke kategorier vi bruker, og hvordan du kan administrere dem."
      path="/informasjonskapsler"
    >
      <LegalSection id="hva" title="1. Hva er informasjonskapsler?">
        <p>
          Informasjonskapsler («cookies») er små tekstfiler som lagres på enheten din når du besøker et nettsted.
          Vi bruker også lignende teknologi, som <code className="text-white/80">localStorage</code> og
          <code className="text-white/80"> sessionStorage</code>, for å få nettstedet til å fungere og for å huske
          innstillinger og innlogging.
        </p>
      </LegalSection>

      <LegalSection id="kategorier" title="2. Hvilke kategorier vi bruker">
        <LegalSubheading>Nødvendige</LegalSubheading>
        <p>
          Kreves for at nettstedet skal fungere, f.eks. for å huske at du er innlogget i kundeportalen og for
          sikkerhet. Disse kan ikke slås av i våre systemer.
        </p>

        <LegalSubheading>Preferanser</LegalSubheading>
        <p>Husker valgene og innstillingene dine, slik at opplevelsen blir mer personlig.</p>

        <LegalSubheading>Statistikk / analyse</LegalSubheading>
        <p>
          Hjelper oss å forstå hvordan besøkende bruker nettstedet, slik at vi kan forbedre det. Disse dataene er
          aggregerte og brukes ikke til å identifisere deg personlig.
        </p>

        <LegalSubheading>Markedsføring</LegalSubheading>
        <p>
          Settes av oss eller tredjeparter for å måle og tilpasse markedsføring. Disse settes kun dersom du
          samtykker.
        </p>
      </LegalSection>

      <LegalSection id="tredjeparter" title="3. Tredjepartstjenester">
        <p>
          Enkelte funksjoner på nettstedet leveres av tredjeparter som kan sette egne informasjonskapsler. Disse
          omfatter blant annet:
        </p>
        <LegalList
          items={[
            'Innlogging med Google og andre innloggingsleverandører (autentisering av kontoen din).',
            'Booking- og kalenderverktøy som brukes for å avtale møter.',
            'Eventuelle innebygde chat-, analyse- eller videoverktøy.',
            'Innebygd innhold fra sosiale medier.',
          ]}
        />
        <p>
          Hvilke Google-data vi behandler ved innlogging er beskrevet i vår{' '}
          <Link to="/personvern" className="text-[#FF5B00] hover:underline">
            personvernerklæring
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection id="administrere" title="4. Hvordan du administrerer informasjonskapsler">
        <LegalList
          items={[
            'Du kan slette og blokkere informasjonskapsler i nettleserinnstillingene dine.',
            'De fleste nettlesere lar deg avvise alle eller utvalgte informasjonskapsler.',
            'Blokkering av nødvendige informasjonskapsler kan føre til at deler av nettstedet, som innlogging, ikke fungerer.',
          ]}
        />
        <p>
          Du kan lese mer om hvordan du administrerer informasjonskapsler i din nettleser via leverandørens egne
          hjelpesider.
        </p>
      </LegalSection>

      <LegalSection id="samtykke" title="5. Samtykke">
        <p>
          Nødvendige informasjonskapsler settes på grunnlag av vår berettigede interesse i å levere et fungerende
          nettsted. Informasjonskapsler for statistikk og markedsføring settes kun der du har gitt samtykke, og du kan
          når som helst trekke samtykket tilbake ved å endre nettleserinnstillingene dine eller kontakte oss.
        </p>
      </LegalSection>

      <LegalSection id="endringer" title="6. Endringer">
        <p>
          Vi kan oppdatere denne erklæringen når bruken av informasjonskapsler endres. «Sist oppdatert»-datoen øverst
          viser gjeldende versjon.
        </p>
      </LegalSection>
    </LegalLayout>
  );
};
