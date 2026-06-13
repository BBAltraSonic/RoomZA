import {forwardRef, useContext, useEffect, useImperativeHandle, useRef} from 'react';
import {GoogleMapsContext, latLngEquals} from '@vis.gl/react-google-maps';

type CircleEventProps = {
  onClick?: (e: google.maps.MapMouseEvent) => void;
  onDrag?: (e: google.maps.MapMouseEvent) => void;
  onDragStart?: (e: google.maps.MapMouseEvent) => void;
  onDragEnd?: (e: google.maps.MapMouseEvent) => void;
  onMouseOver?: (e: google.maps.MapMouseEvent) => void;
  onMouseOut?: (e: google.maps.MapMouseEvent) => void;
  onRadiusChanged?: (r: ReturnType<google.maps.Circle['getRadius']>) => void;
  onCenterChanged?: (p: ReturnType<google.maps.Circle['getCenter']>) => void;
};

export type CircleProps = google.maps.CircleOptions & CircleEventProps;

export type CircleRef = google.maps.Circle | null;

export const Circle = forwardRef<CircleRef, CircleProps>((props, ref) => {
  const {
    onClick,
    onDrag,
    onDragStart,
    onDragEnd,
    onMouseOver,
    onMouseOut,
    onRadiusChanged,
    onCenterChanged,
    ...circleOptions
  } = props;

  const callbacks = useRef<Record<string, (e: unknown) => void>>({});
  Object.assign(callbacks.current, {
    onClick,
    onDrag,
    onDragStart,
    onDragEnd,
    onMouseOver,
    onMouseOut,
    onRadiusChanged,
    onCenterChanged
  });

  const circle = useRef(new google.maps.Circle()).current;
  useImperativeHandle(ref, () => circle, [circle]);
  // update circleOptions (note the dependencies aren't properly checked
  // here, we just assume that setOptions is smart enough to not waste a
  // lot of time updating values that didn't change)
  circle.setOptions(circleOptions);

  useEffect(() => {
    if (!circleOptions.center) return;
    if (!latLngEquals(circleOptions.center, circle.getCenter())) {
      circle.setCenter(circleOptions.center);
    }
  }, [circleOptions.center, circle]);

  useEffect(() => {
    if (circleOptions.radius === undefined || circleOptions.radius === null) return;
    if (circleOptions.radius !== circle.getRadius()) {
      circle.setRadius(circleOptions.radius);
    }
  }, [circleOptions.radius, circle]);

  const map = useContext(GoogleMapsContext)?.map;

  useEffect(() => {
    if (!map) {
      if (map === undefined)
        console.error('<Circle> has to be inside a Map component.');
      return;
    }

    circle.setMap(map);

    return () => {
      circle.setMap(null);
    };
  }, [map, circle]);

  useEffect(() => {
    if (!circle) return;

    const gme = google.maps.event;
    [
      ['click', 'onClick'],
      ['drag', 'onDrag'],
      ['dragstart', 'onDragStart'],
      ['dragend', 'onDragEnd'],
      ['mouseover', 'onMouseOver'],
      ['mouseout', 'onMouseOut']
    ].forEach(([eventName, eventCallback]) => {
      gme.addListener(circle, eventName, (e: google.maps.MapMouseEvent) => {
        const callback = callbacks.current[eventCallback];
        if (callback) callback(e);
      });
    });

    gme.addListener(circle, 'radius_changed', () => {
      const newRadius = circle.getRadius();
      callbacks.current.onRadiusChanged?.(newRadius);
    });

    gme.addListener(circle, 'center_changed', () => {
      const newCenter = circle.getCenter();
      callbacks.current.onCenterChanged?.(newCenter);
    });

    return () => {
      gme.clearInstanceListeners(circle);
    };
  }, [circle]);

  return null;
});

Circle.displayName = 'Circle';
