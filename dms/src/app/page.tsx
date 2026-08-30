import Hero from "./components/Hero";
import Services from "./components/Services";
import BeforeAfterSlider from "./components/BeforeAfterSlider";
import BrushingHighlight from "./components/BrushingHighlight";
import Doctors from "./components/Doctors";
import Login from "./components/Login";


const HARDCODED_SLUG = "chitwan-dental-home";

export default function Home() {
  return (
    <main className="relative overflow-hidden">
      <Login />

      {/* <Hero />
      <Services />

      <BeforeAfterSlider 
        beforeImage="/images/before-after/before.png"
        afterImage="/images/before-after/after.png"
        beforeLabel="Before"
        afterLabel="After"
      />
      
      <Doctors  />
      <BrushingHighlight  /> */}
    </main>
  );
}