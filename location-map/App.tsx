import React, { useState, useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
// Import location services from Expo
import * as Location from "expo-location";
// Map
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";

export default function App() {
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        console.log("Permission to access location was denied");
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      console.log(location);
    })();
  }, []);
  const initialRegion = {
    latitude: 17.803266,
    longitude: 102.747888,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  };
  return (
    <View>
      <MapView
        provider={PROVIDER_DEFAULT}
        initialRegion={initialRegion}
        showsUserLocation={true}
        style={{ width: "100%", height: "100%" }}
      >
        <Marker
          coordinate={{ latitude: 17.803266, longitude: 102.747888 }}
          title="My location"
          description="I am here"
          pinColor="blue"
        />
      </MapView>
    </View>
    // <View style={styles.container}>
    //   <Text>Open up App.tsx to start working on your app!</Text>
    //   <StatusBar style="auto" />
    // </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});
