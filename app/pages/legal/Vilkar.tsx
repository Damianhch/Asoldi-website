import React from 'react';
import { Link } from 'react-router-dom';
import {
  LegalLayout,
  LegalSection,
  LegalSubheading,
  LegalList,
  LegalCallout,
} from '../../components/legal/LegalLayout';

export const Vilkar = () => {
  return (
    <LegalLayout
      title="Vilkår for bruk"
      description="Vilkårene for bruk av asoldi.com og for tjenestene Asoldi Markedsføring leverer. Ved å bruke nettstedet, opprette en konto eller inngå en tjenesteavtale med oss, aksepterer du disse vilkårene."
      path="/vilkar"
    >
      <LegalSection id="om-vilkarene" title="1. Om vilkårene">
        <p>
          Disse vilkårene gjelder for bruk av nettstedet asoldi.com, kundeportalen og alle tjenester levert av Asoldi
          Markedsføring (drevet under foretaket CHAPANA, org.nr. 934 327 497) («Asoldi», «vi», «oss»).
        </p>
        <p>
          Ved å bruke nettstedet, opprette en konto, velge en tjenestepakke eller på annen måte inngå et
          kundeforhold med oss, bekrefter du at du har lest og godtar disse vilkårene samt vår{' '}
          <Link to="/personvern" className="text-[#FF5B00] hover:underline">
            personvernerklæring
          </Link>
          . Vilkårene utgjør avtalegrunnlaget mellom deg og Asoldi – du trenger ikke å signere et separat dokument for
          at vilkårene skal gjelde.
        </p>
      </LegalSection>

      <LegalSection id="bruk-av-nettstedet" title="2. Bruk av nettstedet og kontoen">
        <LegalList
          items={[
            'Du er ansvarlig for at opplysningene du oppgir er korrekte og oppdaterte.',
            'Du er ansvarlig for å holde innloggingsinformasjonen din konfidensiell og for all aktivitet på kontoen din.',
            'Du skal ikke misbruke nettstedet, forsøke å skaffe uautorisert tilgang, eller bruke tjenestene til ulovlige formål.',
            'Personen som inngår en avtale på vegne av en virksomhet bekrefter å ha fullmakt til å ta beslutninger for virksomheten. Uten slik fullmakt er avtalen ugyldig.',
          ]}
        />
      </LegalSection>

      <LegalSection id="tjenestevilkar" title="3. Tjenestevilkår (abonnement)">
        <p>
          Følgende vilkår gjelder når du inngår en tjenesteavtale med Asoldi om utvikling, hosting, vedlikehold og
          digitale tjenester. Avtaleperioden starter den dagen tjenesteavtalen inngås. Du velger én (1) av
          tjenestepakkene beskrevet nedenfor.
        </p>

        <LegalSubheading>Nivå 1 – Nettsidepakke (1000 kr per måned)</LegalSubheading>
        <LegalList
          items={[
            'Full utvikling av en enkel nettside uten nettbutikk.',
            'Hosting og vedlikehold under aktivt abonnement.',
            'Kontaktskjema.',
            'Alle seksjoner som kreves for en standard bedriftsnettside, unntatt nettbutikk og visning av anmeldelser.',
            'Opptil fire (4) endringer per måned i layout eller visuelt innhold (bilder, video, layoutstruktur).',
            'Ingen tillegg eller fjerning av seksjoner og ingen avansert funksjonalitet.',
            'Leveringstid: 2 uker fra prosjektstart.',
          ]}
        />

        <LegalSubheading>Nivå 2 – Nettside + SEO + E-post + Analyse (1500 kr per måned)</LegalSubheading>
        <p>Inkluderer alt i Nivå 1, i tillegg til:</p>
        <LegalList
          items={[
            'SEO-optimalisering for 1–3 nøkkelord.',
            'Funksjonalitet for visning av anmeldelser.',
            'Synkronisering med sosiale medier.',
            'Innsamling og lagring av e-postlister for markedsføringsformål.',
            'Innledende veiledningsmøte om hvor e-postlister kan finnes.',
            'Leveringstid: 2 uker fra prosjektstart.',
          ]}
        />

        <LegalSubheading>Nivå 3 – Nettside + Nettbutikk (2000 kr per måned)</LegalSubheading>
        <p>Inkluderer alt i Nivå 2, i tillegg til:</p>
        <LegalList
          items={[
            'Nettbutikkfunksjonalitet, inkludert oppsett av butikk, produktsider, utsjekk og brukerregistrering.',
            'Analysepanel tilgjengelig i CMS.',
            'Visning av fluktfrekvens, besøksrater og gjennomsnittlig ordreverdi.',
            'Innledende veiledningsmøte og gjennomgang av nettbutikk- og analysefunksjonalitet.',
            'Leveringstid: 3 uker fra prosjektstart.',
          ]}
        />
      </LegalSection>

      <LegalSection id="betaling" title="4. Betalingsvilkår">
        <LegalList
          items={[
            'Månedlige betalinger skjer den 1. i hver måned.',
            'Første måned faktureres forholdsmessig: månedspris ÷ antall dager i måneden × antall gjenværende dager etter levering.',
            'Faktura for første måned forfaller innen 7 dager etter levering av produktet. Påfølgende fakturaer forfaller innen 7 dager etter utstedelse.',
            'Godkjente betalingsmetoder: bankoverføring og Stripe.',
            'Det er ingen etableringsavgift.',
            'Ved forsinket betaling påløper et gebyr på 100 kr etter 14 dager. Ved fortsatt manglende betaling kan tjenesten suspenderes og avtalen sies opp, se punkt 13.',
          ]}
        />
      </LegalSection>

      <LegalSection id="bindingstid" title="5. Avtaleperiode og oppsigelse">
        <LegalList
          items={[
            'Minste bindingstid er 6 måneder.',
            'Oppsigelse krever 15 dagers varsel, og kunden betaler for hele oppsigelsesmåneden.',
            'Kunden kan ikke nedgradere til et lavere nivå etter at funksjonalitet fra et høyere nivå er lagt til.',
            'Ved oppsigelse får kunden full tilgang til nettsidedesign og eventuell spesialutviklet kode, med unntak av det som følger av punkt 7.',
            'Asoldi kan utføre migrering av hosting og eventuell domeneoverføring for 1400 kr, eller kostnadsfritt bistå kunden med å åpne hosting og domene slik at kunden selv kan gjennomføre overføringen.',
            'Dersom nettsiden ikke er overført til kunden innen 15 dager fra oppsigelse, arkiverer Asoldi designet og beholder fullt eierskap. For å få tilgang til designet igjen må kunden betale migreringsgebyret.',
          ]}
        />
      </LegalSection>

      <LegalSection id="arbeidsomfang" title="6. Arbeidsomfang">
        <p>Asoldi skal levere:</p>
        <LegalList
          items={[
            'Profesjonelt nettsidedesign og utvikling i henhold til valgt tjenestenivå.',
            'Hosting og vedlikehold under aktivt abonnement.',
            'Rimelige månedlige oppdateringer, opptil fire endringer per måned, fleksibelt avhengig av kompleksitet.',
            'Ingen opplæring i redigering av nettsiden; enkle spørsmål er tillatt som del av administrasjonen.',
          ]}
        />
        <p>
          En revisjon omfatter: tekstendringer, tillegg av en seksjon eller tillegg av funksjonalitet. Retting av
          skrivefeil eller faktiske feil regnes ikke som en revisjon. Redesign eller arbeid utenfor avtalt pakke
          medfører ekstra kostnader som avtales mellom partene.
        </p>
      </LegalSection>

      <LegalSection id="garanti" title="7. Leveringsgaranti, hosting og eierskap">
        <LegalSubheading>Leveringsgaranti</LegalSubheading>
        <p>
          Dersom Asoldi ikke leverer nettsiden innen tidsrammen for valgt pakke (2 eller 3 uker), får kunden én (1)
          måned med tjeneste gratis.
        </p>

        <LegalSubheading>Hostingfeil</LegalSubheading>
        <p>
          Dersom Asoldi over lengre tid blir ute av stand til å hoste nettsiden, mottar kunden en full eksport
          (inkludert SQL-fil og nødvendige nettsidefiler) kostnadsfritt. Full migrering til nytt domene eller ny
          hostingleverandør er valgfritt.
        </p>

        <LegalSubheading>Immaterielle rettigheter og eierskap</LegalSubheading>
        <LegalList
          items={[
            'I abonnementsperioden har kunden full rett til å bruke nettsiden.',
            'Ved oppsigelse beholder kunden eierskap til nettsidedesignet og eventuell kode utviklet spesifikt for kunden.',
            'Etter 15 dager fra oppsigelse går eierskapet fullt tilbake til Asoldi dersom kunden ikke har eksportert eller migrert nettsiden.',
            'Hostingmiljø, DNS-oppføringer, temaer, utvidelser/plugins og tredjepartslisenser forblir Asoldis eiendom.',
          ]}
        />
      </LegalSection>

      <LegalSection id="support" title="8. Support og vedlikehold">
        <LegalList
          items={[
            'Supporttider: 09:00–16:00 CET.',
            'Responstid for standardforespørsler: 1–3 dager.',
            'Responstid for hastesaker: innen 1 dag.',
          ]}
        />
      </LegalSection>

      <LegalSection id="kundens-ansvar" title="9. Kundens ansvar">
        <p>Kunden skal levere materialet som kreves for nettsiden, herunder:</p>
        <LegalList items={['Logo(er).', 'Bilder og/eller videoer.', 'Annet ønsket materiale som er nødvendig for nettsiden.']} />
      </LegalSection>

      <LegalSection id="gdpr" title="10. GDPR og databehandling">
        <LegalList
          items={[
            'Kunden er behandlingsansvarlig for personopplysninger som samles inn via nettsiden.',
            'Asoldi er databehandler og kan få tilgang til data for vedlikehold, sikkerhet og korrekt funksjonalitet.',
            'Kunden er ansvarlig for GDPR-overholdelse knyttet til kundedata som samles inn via skjemaer, nettbutikk eller e-postlister.',
          ]}
        />
        <p>
          Se vår{' '}
          <Link to="/personvern" className="text-[#FF5B00] hover:underline">
            personvernerklæring
          </Link>{' '}
          for hvordan Asoldi behandler personopplysninger.
        </p>
      </LegalSection>

      <LegalSection id="ansvarsbegrensning" title="11. Ansvarsbegrensning">
        <p>Asoldi er ikke ansvarlig for:</p>
        <LegalList
          items={['indirekte, tilfeldige eller følgeskader,', 'tap av inntekter, virksomhet eller data.']}
        />
        <p>
          Asoldis samlede ansvar er begrenset til beløpet kunden betalte ved siste månedlige betaling. Tjenestene
          leveres «som de er», og vi gir ingen garanti for spesifikke kommersielle resultater.
        </p>
      </LegalSection>

      <LegalSection id="portefolje" title="12. Porteføljerettigheter">
        <p>
          Asoldi kan vise kundens nettside i porteføljer, annonser og markedsføringsmateriell, med mindre kunden
          reserverer seg mot dette ved skriftlig henvendelse.
        </p>
      </LegalSection>

      <LegalSection id="mislighold" title="13. Betalingsmislighold og suspensjon">
        <p>Dersom betaling ikke er mottatt innen 7 dager etter forfall, sendes en påminnelse til kunden.</p>
        <p>Dersom betaling ikke er mottatt innen 14 dager etter forfall:</p>
        <LegalList
          items={[
            'nettsiden suspenderes midlertidig (tas offline) frem til betaling er mottatt,',
            'et purregebyr på NOK 100,- legges til i tillegg til nettsidekostnaden for hver dag som går etter de første 14 dagene.',
          ]}
        />
        <p>Dersom betaling ikke er mottatt innen 30 dager:</p>
        <LegalList
          items={[
            'utestående beløp kan sendes til inkasso,',
            'purregebyret legges til inkassokravet hver 14. dag i avdrag frem til hele beløpet er betalt, med mindre annen intern avtale er inngått,',
            'kunden forblir ansvarlig for alle ubetalte fakturaer.',
          ]}
        />
        <p>Asoldi forbeholder seg retten til å suspendere tjenester umiddelbart dersom svindelaktig betalingsaktivitet oppdages.</p>
      </LegalSection>

      <LegalSection id="lovvalg" title="14. Lovvalg og endringer">
        <p>
          Disse vilkårene er underlagt norsk lov. Eventuelle tvister søkes løst i minnelighet, og ellers ved norske
          domstoler.
        </p>
        <p>
          Vi kan oppdatere vilkårene ved behov. Vesentlige endringer varsles på nettstedet, og fortsatt bruk av
          tjenestene etter at endringer er publisert regnes som aksept av de oppdaterte vilkårene.
        </p>
      </LegalSection>

      <LegalCallout title="Slik inngås avtalen">
        <p>
          Du aksepterer disse vilkårene når du tar i bruk nettstedet eller kundeportalen, velger en tjenestepakke
          eller bekrefter en bestilling – uten behov for et separat signert dokument. Det konkrete tjenestenivået,
          prisen og oppstartsdatoen fremgår av bestillingen eller bekreftelsen du mottar fra oss.
        </p>
      </LegalCallout>
    </LegalLayout>
  );
};
