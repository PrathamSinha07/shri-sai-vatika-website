import Hero from "@/components/sections/Hero";
import Intro from "@/components/sections/Intro";
import Facilities from "@/components/sections/Facilities";
import Venue from "@/components/sections/Venue";
import Director from "@/components/sections/Director";
import Services from "@/components/sections/Services";
import Gallery from "@/components/sections/Gallery";
import BookVisitForm from "@/components/sections/BookVisitForm";
import ScrollReset from "@/components/ScrollReset";

export default function Home() {
  return (
    <>
      <ScrollReset />
      <Hero />
      <Intro />
      <Venue />
      <Director />
      <Facilities />
      <Services />
      <Gallery />
      <section
        id="book-a-visit"
        className="bg-background"
        aria-labelledby="book-a-visit-heading"
      >
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow">Plan Your Visit</p>
            <h2 id="book-a-visit-heading" className="font-display text-section mt-4 text-primary-deep">
              Visiting Shri Sai Vatika
            </h2>
            <p className="text-body mt-5 text-muted-foreground">
              Choose a convenient date and time to visit Shri Sai Vatika.
              Select an available slot and send us your visit request.
            </p>
          </div>
          <div className="mt-12">
            <BookVisitForm />
          </div>
        </div>
      </section>
    </>
  );
}
