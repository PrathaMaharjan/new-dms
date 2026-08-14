import Hero from "./components/Hero";
import Services from "./components/Services";
import BeforeAfterSlider from "./components/BeforeAfterSlider";
import BrushingHighlight from "./components/BrushingHighlight";
import Doctors from "./components/Doctors";


const HARDCODED_SLUG = "chitwan-dental-home";

export default function Home() {
  return (
    <main className="relative overflow-hidden">

      <Hero tenantSlug={HARDCODED_SLUG} />
      <Services tenantSlug={HARDCODED_SLUG} />

      <BeforeAfterSlider tenantSlug={HARDCODED_SLUG}
        beforeImage="/images/before-after/before.png"
        afterImage="/images/before-after/after.png"
        beforeLabel="Before"
        afterLabel="After"
      />
      
      <Doctors tenantSlug={HARDCODED_SLUG} />
      <BrushingHighlight tenantSlug={HARDCODED_SLUG} />
    </main>
  );
}