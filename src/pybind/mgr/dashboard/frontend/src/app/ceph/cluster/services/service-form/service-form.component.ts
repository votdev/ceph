import { Component, OnInit } from '@angular/core';
import { Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { I18n } from '@ngx-translate/i18n-polyfill';
import * as _ from 'lodash';
import { Observable } from 'rxjs';
import { debounceTime, distinctUntilChanged, map } from 'rxjs/operators';

import { CephServiceService } from '../../../../shared/api/ceph-service.service';
import { HostService } from '../../../../shared/api/host.service';
import { SelectMessages } from '../../../../shared/components/select/select-messages.model';
import { ActionLabelsI18n, URLVerbs } from '../../../../shared/constants/app.constants';
import { CdForm } from '../../../../shared/forms/cd-form';
import { CdFormBuilder } from '../../../../shared/forms/cd-form-builder';
import { CdFormGroup } from '../../../../shared/forms/cd-form-group';
import { CdValidators } from '../../../../shared/forms/cd-validators';
import { FinishedTask } from '../../../../shared/models/finished-task';
import { TaskWrapperService } from '../../../../shared/services/task-wrapper.service';

@Component({
  selector: 'cd-service-form',
  templateUrl: './service-form.component.html',
  styleUrls: ['./service-form.component.scss']
})
export class ServiceFormComponent extends CdForm implements OnInit {
  serviceForm: CdFormGroup;
  action: string;
  resource: string;
  service_types: string[] = [
    'alertmanager',
    'crash',
    'grafana',
    'iscsi',
    'mds',
    'mgr',
    'mon',
    'nfs',
    'node-exporter',
    'prometheus',
    'rbd-mirror',
    'rgw'
  ];
  hosts: any;
  labels: string[];

  constructor(
    public actionLabels: ActionLabelsI18n,
    private cephServiceService: CephServiceService,
    private formBuilder: CdFormBuilder,
    private hostService: HostService,
    private i18n: I18n,
    private router: Router,
    private taskWrapperService: TaskWrapperService
  ) {
    super();
    this.resource = this.i18n('service');
    this.hosts = {
      options: [
        { enabled: true, name: 'mon0' },
        { enabled: true, name: 'mgr0' },
        { enabled: true, name: 'osd0' }
      ],
      messages: new SelectMessages(
        {
          empty: i18n('There are no hosts.'),
          filter: i18n('Filter hosts')
        },
        i18n
      )
    };
    this.createForm();
  }

  createForm() {
    this.serviceForm = this.formBuilder.group({
      // Global
      service_type: [null, [Validators.required]],
      service_id: [null],
      // unmanaged: [false], // useless for services except OSD
      placement: ['hosts'],
      label: [
        null,
        [
          CdValidators.requiredIf({
            placement: 'label'
          })
        ]
      ],
      hosts: [[]],
      count: [null, Validators.min(1)],
      // NFS
      pool: [
        null,
        [
          CdValidators.requiredIf({
            service_type: 'nfs'
          })
        ]
      ],
      namespace: [null],
      // RGW
      rgw_realm: [
        null,
        [
          CdValidators.requiredIf({
            ssl: true
          }),
          CdValidators.requiredIf({
            rgw_zone: { op: '!empty' }
          })
        ]
      ],
      rgw_zone: [
        null,
        [
          CdValidators.requiredIf({
            ssl: true
          }),
          CdValidators.requiredIf({
            rgw_realm: { op: '!empty' }
          })
        ]
      ],
      subcluster: [null],
      rgw_frontend_port: [null],
      ssl: [null],
      // iSCSI
      trusted_ip_list: [null],
      api_port: [null],
      api_user: [null],
      api_password: [null],
      api_secure: [null],
      ssl_cert: [null],
      ssl_key: [null]
    });
  }

  ngOnInit(): void {
    this.action = this.actionLabels.CREATE;
    this.hostService.getLabels().subscribe((resp: string[]) => {
      this.labels = resp;
    });
  }

  goToListView() {
    this.router.navigate(['/services']);
  }

  searchLabels = (text$: Observable<string>) => {
    return text$.pipe(
      debounceTime(200),
      distinctUntilChanged(),
      map((value) =>
        this.labels
          .filter((label: string) => label.toLowerCase().indexOf(value.toLowerCase()) > -1)
          .slice(0, 10)
      )
    );
  };

  onSubmit() {
    const self = this;
    const values = this.serviceForm.value;
    const serviceSpec = {
      // unmanaged: values['unmanaged'],
      service_type: values['service_type'],
      placement: {}
    };
    const serviceName = serviceSpec['service_id']
      ? `${serviceSpec['service_type']}.${serviceSpec['service_id']}`
      : serviceSpec['service_type'];
    _.join([serviceSpec['service_type'], serviceSpec['service_id']], '.');
    switch (values['placement']) {
      case 'hosts':
        if (values['hosts'].length > 0) {
          serviceSpec['placement']['hosts'] = values['hosts'];
        }
        break;
      case 'label':
        serviceSpec['placement']['label'] = values['label'];
        break;
    }
    if (_.isNumber(values['count']) && values['count'] > 0) {
      serviceSpec['placement']['count'] = values['count'];
    }
    if (_.isString(values['service_id']) && !_.isEmpty(values['service_id'])) {
      serviceSpec['service_id'] = values['service_id'];
    }
    switch (serviceSpec['service_type']) {
      case 'nfs':
        break;
      case 'rgw':
        break;
      case 'iscsi':
        break;
    }
    this.taskWrapperService
      .wrapTaskAroundCall({
        task: new FinishedTask(`service/${URLVerbs.CREATE}`, {
          service_name: serviceName
        }),
        call: this.cephServiceService.create(serviceSpec)
      })
      .subscribe({
        error() {
          self.serviceForm.setErrors({ cdSubmitButton: true });
        },
        complete() {
          self.goToListView();
        }
      });
  }
}
