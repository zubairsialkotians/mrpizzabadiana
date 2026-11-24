import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import DocView from './DocView';
import { setPrintHost } from '../services/printer';

/*
  Draws the bill off screen and takes a picture of it, exactly like "Share image" on the Bill screen,
  so what prints is that same bill. Mounted once in App.js: works from any screen, also for the
  automatic print right after an order is placed.
*/
export default function PrintHost() {
  const [job, setJob] = useState(null); // { model, width, resolve, reject }
  const ref = useRef(null);
  const size = useRef(null);

  useEffect(() => {
    setPrintHost((model, width) => new Promise((resolve, reject) => {
      size.current = null;
      setJob({ model, width, resolve, reject });
    }));
    return () => setPrintHost(null);
  }, []);

  const onLayout = (e) => {
    if (!job || size.current) return;
    const { width, height } = e.nativeEvent.layout;
    size.current = { width, height };
    const current = job;
    // Give the logo a moment to load, then capture
    setTimeout(async () => {
      try {
        const base64 = await captureRef(ref, { format: 'png', quality: 1, result: 'base64' });
        current.resolve({ base64, width, height });
      } catch (err) {
        current.reject(err);
      } finally {
        setJob(null);
      }
    }, 600);
  };

  if (!job) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: -10000, top: 0, opacity: 1 }}>
      <View collapsable={false} onLayout={onLayout}>
        <DocView ref={ref} model={job.model} width={job.width} />
      </View>
    </View>
  );
}
