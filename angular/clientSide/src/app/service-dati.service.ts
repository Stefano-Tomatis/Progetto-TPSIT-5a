import { Injectable } from '@angular/core';
import { signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ServiceDatiService {

  constructor() { }

  isAdmin = signal <boolean>(false);
  isUser = signal <boolean>(false);
  isDoctor = signal <boolean>(false);

  loginAdmin(){
    this.isAdmin.set(true);
    this.isUser.set(false);
    this.isDoctor.set(false);
  }

  loginUser(){
    this.isAdmin.set(false);
    this.isUser.set(true);
    this.isDoctor.set(false);
  }

  loginDoctor(){
    this.isAdmin.set(false);
    this.isUser.set(false);
    this.isDoctor.set(true);
  }

  logOutAdmin(){
    this.isAdmin.set(false);
  }
  logOutUser(){
    this.isUser.set(false);
  }
  logOutDoctor(){
    this.isDoctor.set(false);
  }

}
