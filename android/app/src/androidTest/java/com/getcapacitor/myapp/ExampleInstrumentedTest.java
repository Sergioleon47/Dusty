package com.getcapacitor.myapp;

import static org.junit.Assert.*;

import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * Instrumented test, which will execute on an Android device.
 *
 * @see <a href="http://d.android.com/tools/testing">Testing documentation</a>
 */
@RunWith(AndroidJUnit4.class)
public class ExampleInstrumentedTest {

    @Test
    public void useAppContext() throws Exception {
        // Context of the app under test.
        Context appContext = InstrumentationRegistry.getInstrumentation().getTargetContext();

        // El applicationId real es com.dusty.inventory (android/app/build.gradle).
        // La plantilla de Capacitor deja acá "com.getcapacitor.app", su propio
        // nombre de ejemplo, así que esta única prueba instrumentada del proyecto
        // fallaba desde el día uno — no la corría nadie porque necesita un
        // dispositivo/emulador y el CI solo corre Node. Es la comprobación de que
        // el paquete que se instala es el mismo que Play Store tiene reservado:
        // si alguien cambia el applicationId, la actualización deja de ser una
        // actualización de esta ficha y esto lo avisa.
        assertEquals("com.dusty.inventory", appContext.getPackageName());
    }
}
