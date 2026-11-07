import { MapPin } from "lucide-react";
import { locationSourceLabel, type TransactionLocation } from "../platform/location";

export function LocationPolicy({ address }: { address?: string }) {
  return <p className="support location-policy">
    Your device location is captured when you submit, with your permission.
    {address ? ` If unavailable, we record the profile address: ${address}.` : " If unavailable, the record will say so."}
    {" "}Location is an estimate and may not identify a specific shop.
  </p>;
}

export function RecordedLocation({ location }: { location?: TransactionLocation }) {
  return <div className="review-context recorded-location">
    <MapPin size={20} aria-hidden="true" />
    <div>
      <small>RECORDED LOCATION</small>
      {location && <strong>{location.address}</strong>}
      <span>{locationSourceLabel(location)}</span>
      {location?.source === "device" && <span>
        {location.latitude?.toFixed(5)}, {location.longitude?.toFixed(5)}
      </span>}
    </div>
  </div>;
}
