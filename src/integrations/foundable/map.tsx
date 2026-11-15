// Foundable's map of a place for this website: Google Maps on Foundable's own key, so this website needs no maps key.
// Foundable writes this file and replaces it whole, so never edit it.

const mapPlace = "https://foundable.com/api/maps/place";

/** Google Maps' own address for directions to a place, which opens Google Maps and needs no key. */
export function directionsLink(place: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(place)}`;
}

/**
 * A map of one place: `place` as a visitor would type it into Google Maps (an address, or the business's name and town),
 * `title` what a screen reader names the map. It fills its box's width; give it a height with `className`.
 */
export function PlaceMap({ place, title, className }: { place: string; title: string; className?: string }) {
  return (
    <iframe src={`${mapPlace}?q=${encodeURIComponent(place)}`} title={title} className={className} loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
  );
}
