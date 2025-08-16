import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { SignupComponent } from './pages/signup/signup.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { ChatroomComponent } from './fragments/chatroom/chatroom.component';
import { LandingComponent } from './fragments/landing/landing.component';
import { TestComponent } from './fragments/test/test.component';

const routes: Routes = [
  {
    path:'login',
    component:LoginComponent,
  },
  {
    path:'signup',
    component:SignupComponent,
  },
  { path: '', 
    component:DashboardComponent,
    children:[
      {
        path:'chatroom',
        component:TestComponent
      },
      {
        path:'landing',
        component:LandingComponent
      },
      {
        path:'',
        redirectTo:'chatroom',
        pathMatch:'full'
      },
      
    ]
   }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
