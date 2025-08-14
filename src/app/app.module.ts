import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { LoginComponent } from './pages/login/login.component';
import { SignupComponent } from './pages/signup/signup.component';
import { ChatroomComponent } from './fragments/chatroom/chatroom.component';
import { LandingComponent } from './fragments/landing/landing.component';
import { AppLogoComponent } from './components/app-logo/app-logo.component';
import { en_US, hi_IN } from 'ng-zorro-antd/i18n';
import { NZ_I18N } from 'ng-zorro-antd/i18n';


import { NzConfig, provideNzConfig } from 'ng-zorro-antd/core/config';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { IconsProviderModule } from './icons-provider.module';
import { FormsModule } from '@angular/forms';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSegmentedModule } from 'ng-zorro-antd/segmented';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzRateModule } from 'ng-zorro-antd/rate';
import { NzCarouselModule } from 'ng-zorro-antd/carousel';
import { ReactiveFormsModule } from '@angular/forms'
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzFormModule } from 'ng-zorro-antd/form';
import {NzCheckboxModule} from 'ng-zorro-antd/checkbox';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzAffixModule } from 'ng-zorro-antd/affix';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import en from '@angular/common/locales/en';
import { PlanetComponent} from './components/planet/planet.component';
import { FooterComponent } from './components/footer/footer.component';

registerLocaleData(en);

const ngZorroConfig: NzConfig = {
  message: { nzTop: 120 },
  notification: { nzTop: 240 }
};
@NgModule({
  declarations: [
    AppComponent,
    DashboardComponent,
    LoginComponent,
    SignupComponent,
    ChatroomComponent,
    LandingComponent,
    AppLogoComponent,
    PlanetComponent,
    FooterComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    NzDrawerModule,
    NzRadioModule,
    NzButtonModule,
    BrowserAnimationsModule,
    IconsProviderModule,
    NzLayoutModule,
    NzMenuModule,
    NzAvatarModule,
    NzBadgeModule,
    NzInputModule,
    NzSelectModule,
    NzSegmentedModule,
    NzSpaceModule,
    NzRateModule,
    NzCarouselModule,
    ReactiveFormsModule,
    NzGridModule,
    NzFormModule,  
    NzCheckboxModule,
    NzIconModule,
    NzDividerModule,
    NzAffixModule
  ],
  providers: [
    { provide: NZ_I18N, useValue: hi_IN },
    provideAnimationsAsync(),
    provideHttpClient(),
    provideNzConfig(ngZorroConfig)
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
