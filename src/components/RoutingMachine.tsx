import { useEffect } from "react";
import L from "leaflet";
import "leaflet-routing-machine";
import { useMap } from "react-leaflet";

// Fix for default icons in leaflet-routing-machine
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface RoutingMachineProps {
  start: [number, number];
  end: [number, number];
  color?: string;
  obstacles?: any[];
}

export default function RoutingMachine({ start, end, color = "#9333ea", obstacles = [] }: RoutingMachineProps) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    // @ts-ignore
    const routingOptions: any = {
      waypoints: [
        L.latLng(start[0], start[1]),
        L.latLng(end[0], end[1])
      ],
      lineOptions: {
        styles: [{ color: color, weight: 6, opacity: 0.8 }],
        extendToWaypoints: true,
        missingRouteTolerance: 10
      },
      routeWhileDragging: true,
      addWaypoints: true,
      draggableWaypoints: true,
      fitSelectedRoutes: true,
      showAlternatives: true,
      summaryTemplate: '<h2>{name}</h2><h3>{distance}, {time}</h3>',
      createMarker: () => null,
    };

    // @ts-ignore
    const routingControl = L.Routing.control(routingOptions).addTo(map);

    return () => {
      if (routingControl) {
        try {
          // @ts-ignore
          const controlMap = routingControl._map;
          if (controlMap) {
            controlMap.removeControl(routingControl);
          }
        } catch (err) {
          console.error("Routing cleanup error:", err);
        }
      }
    };
  }, [map, start[0], start[1], end[0], end[1], color, JSON.stringify(obstacles)]);

  return null;
}
